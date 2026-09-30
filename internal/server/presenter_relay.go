package server

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

// presenterIdleTTL is how long an unused relay session survives. Devices are
// expected to reconnect (EventSource auto-retry) well within this window.
const presenterIdleTTL = 2 * time.Hour

// presenterMaxSessions caps live relay sessions; pruning keeps the map bounded
// even if clients never disconnect cleanly.
const presenterMaxSessions = 64

// presenterRelay relays presenter messages between devices served by the same
// markview instance (e.g. a phone acting as a slide remote). Payloads are
// small JSON documents validated by the frontend; the server treats them as
// opaque bytes and only fans them out to current SSE subscribers.
type presenterRelay struct {
	mu       sync.Mutex
	sessions map[string]*presenterRelaySession
}

type presenterRelaySession struct {
	subs       map[chan []byte]struct{}
	lastActive time.Time
	// last is the most recent payload, replayed to subscribers that join
	// later (e.g. a phone scanning the QR mid-talk).
	last []byte
}

func newPresenterRelay() *presenterRelay {
	return &presenterRelay{sessions: make(map[string]*presenterRelaySession)}
}

func (r *presenterRelay) publish(session string, payload []byte) {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	for id, s := range r.sessions {
		if id != session && now.Sub(s.lastActive) > presenterIdleTTL {
			for ch := range s.subs {
				close(ch)
			}
			delete(r.sessions, id)
		}
	}
	if len(r.sessions) >= presenterMaxSessions {
		var oldestID string
		var oldest time.Time
		for id, s := range r.sessions {
			if oldestID == "" || s.lastActive.Before(oldest) {
				oldestID = id
				oldest = s.lastActive
			}
		}
		if oldestID != "" && oldestID != session {
			s := r.sessions[oldestID]
			for ch := range s.subs {
				close(ch)
			}
			delete(r.sessions, oldestID)
		}
	}

	sess := r.sessions[session]
	if sess == nil {
		sess = &presenterRelaySession{subs: make(map[chan []byte]struct{})}
		r.sessions[session] = sess
	}
	sess.lastActive = now
	sess.last = payload
	for ch := range sess.subs {
		select {
		case ch <- payload:
		default:
			// Slow subscriber: drop rather than block the publisher.
		}
	}
}

func (r *presenterRelay) subscribe(session string) (<-chan []byte, func()) {
	r.mu.Lock()
	defer r.mu.Unlock()
	sess := r.sessions[session]
	if sess == nil {
		sess = &presenterRelaySession{subs: make(map[chan []byte]struct{})}
		r.sessions[session] = sess
	}
	sess.lastActive = time.Now()
	ch := make(chan []byte, 16)
	if len(sess.last) > 0 {
		ch <- sess.last
	}
	sess.subs[ch] = struct{}{}
	return ch, func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		if cur := r.sessions[session]; cur != nil {
			if _, ok := cur.subs[ch]; ok {
				delete(cur.subs, ch)
				close(ch)
			}
		}
	}
}

func handlePresenterPost(state *State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session := r.PathValue("session")
		if session == "" {
			http.Error(w, "missing session id", http.StatusBadRequest)
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, 64<<10))
		if err != nil {
			http.Error(w, "failed to read body", http.StatusBadRequest)
			return
		}
		if !json.Valid(body) {
			http.Error(w, "body must be a JSON document", http.StatusBadRequest)
			return
		}
		state.presenter.publish(session, body)
		w.WriteHeader(http.StatusNoContent)
	}
}

func handlePresenterEvents(state *State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session := r.PathValue("session")
		if session == "" {
			http.Error(w, "missing session id", http.StatusBadRequest)
			return
		}
		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		ch, unsubscribe := state.presenter.subscribe(session)
		defer unsubscribe()

		fmt.Fprint(w, "event: started\ndata: {}\n\n")
		flusher.Flush()

		heartbeat := time.NewTicker(15 * time.Second)
		defer heartbeat.Stop()

		ctx := r.Context()
		for {
			select {
			case <-ctx.Done():
				return
			case <-heartbeat.C:
				fmt.Fprint(w, ": heartbeat\n\n")
				flusher.Flush()
			case payload, ok := <-ch:
				if !ok {
					return
				}
				fmt.Fprintf(w, "event: message\ndata: %s\n\n", payload)
				flusher.Flush()
			}
		}
	}
}
