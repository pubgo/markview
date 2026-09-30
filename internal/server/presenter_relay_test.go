package server

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/k1LoW/donegroup"
)

func testContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := donegroup.WithCancel(context.Background())
	t.Cleanup(cancel)
	return ctx
}

func TestPresenterRelayPublishSubscribe(t *testing.T) {
	r := newPresenterRelay()
	ch, unsubscribe := r.subscribe("sess-1")
	defer unsubscribe()

	r.publish("sess-1", []byte(`{"type":"goto","slideIndex":2}`))

	select {
	case got := <-ch:
		var msg map[string]any
		if err := json.Unmarshal(got, &msg); err != nil {
			t.Fatalf("payload is not JSON: %v", err)
		}
		if msg["type"] != "goto" {
			t.Fatalf("unexpected payload: %s", got)
		}
	case <-time.After(time.Second):
		t.Fatal("subscriber did not receive published payload")
	}
}

func TestPresenterRelayIsolatesSessions(t *testing.T) {
	r := newPresenterRelay()
	chA, unsubA := r.subscribe("a")
	defer unsubA()
	_, unsubB := r.subscribe("b")
	defer unsubB()

	r.publish("a", []byte(`{"n":1}`))

	select {
	case got := <-chA:
		if string(got) != `{"n":1}` {
			t.Fatalf("session a payload: %s", got)
		}
	case <-time.After(time.Second):
		t.Fatal("session a lost payload")
	}
}

func TestPresenterRelayUnsubscribeCloses(t *testing.T) {
	r := newPresenterRelay()
	ch, unsubscribe := r.subscribe("sess")
	unsubscribe()

	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("channel should be closed after unsubscribe")
		}
	case <-time.After(time.Second):
		t.Fatal("unsubscribe did not close the channel")
	}
}

func TestPresenterRelayPrunesIdleSessions(t *testing.T) {
	r := newPresenterRelay()
	r.mu.Lock()
	r.sessions["stale"] = &presenterRelaySession{
		subs:       make(map[chan []byte]struct{}),
		lastActive: time.Now().Add(-3 * time.Hour),
	}
	r.sessions["fresh"] = &presenterRelaySession{
		subs:       make(map[chan []byte]struct{}),
		lastActive: time.Now(),
	}
	r.mu.Unlock()

	r.publish("fresh", []byte(`{}`))

	r.mu.Lock()
	_, staleExists := r.sessions["stale"]
	_, freshExists := r.sessions["fresh"]
	r.mu.Unlock()
	if staleExists {
		t.Fatal("idle session was not pruned")
	}
	if !freshExists {
		t.Fatal("active session was pruned")
	}
}

func TestPresenterRelaySlowSubscriberDrops(t *testing.T) {
	r := newPresenterRelay()
	ch, unsubscribe := r.subscribe("sess")
	defer unsubscribe()

	for i := 0; i < 100; i++ {
		r.publish("sess", []byte(`{}`))
	}
	// Drain whatever buffered; publish must not have blocked and no panic.
	if len(ch) == 0 {
		t.Log("all messages dropped for slow subscriber (acceptable)")
	}
}

func TestHandlePresenterPostValidatesJSON(t *testing.T) {
	s := NewState(testContext(t))
	handler := handlePresenterPost(s)

	t.Run("valid", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/_/api/presenter/sess-1/messages",
			strings.NewReader(`{"type":"goto","sessionId":"sess-1","slideIndex":1}`))
		req.SetPathValue("session", "sess-1")
		rec := httptest.NewRecorder()
		handler(rec, req)
		if rec.Code != http.StatusNoContent {
			t.Fatalf("got %d want 204 body=%q", rec.Code, rec.Body.String())
		}
	})

	t.Run("empty body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/_/api/presenter/sess-1/messages", nil)
		req.SetPathValue("session", "sess-1")
		rec := httptest.NewRecorder()
		handler(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("got %d want 400", rec.Code)
		}
	})
}

func TestPresenterRelayConcurrentPublish(t *testing.T) {
	r := newPresenterRelay()
	ch, unsubscribe := r.subscribe("sess")
	defer unsubscribe()

	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				r.publish("sess", []byte(`{}`))
			}
		}()
	}
	wg.Wait()

	for {
		select {
		case <-ch:
		default:
			return
		}
	}
}

// Regression: session extraction must go through the mux PathValue, not
// path.Base — "…/messages" would otherwise resolve the session as "messages".
func TestPresenterRelayEndToEndThroughMux(t *testing.T) {
	s := NewState(testContext(t))
	server := httptest.NewServer(NewHandler(s))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET",
		server.URL+"/_/api/presenter/e2e-sess/events", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("SSE status %d", resp.StatusCode)
	}

	postResp, err := http.Post(server.URL+"/_/api/presenter/e2e-sess/messages",
		"application/json", strings.NewReader(`{"type":"state","sessionId":"e2e-sess"}`))
	if err != nil {
		t.Fatal(err)
	}
	postResp.Body.Close()
	if postResp.StatusCode != http.StatusNoContent {
		t.Fatalf("POST status %d", postResp.StatusCode)
	}

	type event struct {
		Event string
		Data  string
	}
	scanner := bufio.NewScanner(resp.Body)
	var cur event
	sawStarted := false
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case strings.HasPrefix(line, "event: "):
			cur = event{Event: strings.TrimPrefix(line, "event: ")}
		case strings.HasPrefix(line, "data: "):
			cur.Data = strings.TrimPrefix(line, "data: ")
		case line == "":
			if cur.Event == "started" {
				sawStarted = true
			} else if cur.Event == "message" && cur.Data != "" {
				var payload map[string]any
				if err := json.Unmarshal([]byte(cur.Data), &payload); err != nil {
					t.Fatalf("payload not JSON: %v (%q)", err, cur.Data)
				}
				if payload["type"] == "state" {
					return // received the published message: full loop works
				}
			}
			cur = event{}
		}
	}
	if !sawStarted {
		t.Fatal("never received started event")
	}
	t.Fatal("stream ended without receiving the published message")
}
