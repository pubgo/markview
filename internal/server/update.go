package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/pubgo/markview/internal/update"
	"github.com/pubgo/markview/version"
)

// writeJSONResponse encodes v as a JSON body with the matching content type.
func writeJSONResponse(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("failed to encode JSON response", "error", err)
	}
}

// errAlreadyUpToDate is returned by the apply path when the latest release
// is not newer than the running build.
var errAlreadyUpToDate = errors.New("already up to date")

// updateCheckFn and updateApplyFn are the pluggable backends behind the
// update endpoints. They are package variables so tests can stub them out.
var (
	updateCheckFn = defaultUpdateCheck
	updateApplyFn = defaultUpdateApply
)

func defaultUpdateClient() *update.Client {
	return update.NewClient("")
}

func defaultUpdateCheck(ctx context.Context) (string, string, error) {
	rel, err := defaultUpdateClient().Latest(ctx)
	if err != nil {
		return "", "", err
	}
	return version.Version, rel.TagName, nil
}

func defaultUpdateApply(ctx context.Context) error {
	client := defaultUpdateClient()
	rel, err := client.Latest(ctx)
	if err != nil {
		return err
	}
	if !update.IsNewer(rel.TagName) {
		return errAlreadyUpToDate
	}
	return client.Apply(ctx, rel)
}

// updateCache keeps a short-lived copy of the last check result so several
// open tabs do not each hit the release API on every page load.
var (
	updateCacheMu   sync.Mutex
	updateCache     updateCheckResponse
	updateCacheAt   time.Time
	updateCacheTTL  = 5 * time.Minute
	updateCacheHave bool
)

type updateCheckResponse struct {
	Current   string `json:"current"`
	Latest    string `json:"latest"`
	Available bool   `json:"available"`
}

func handleUpdateCheck() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		updateCacheMu.Lock()
		if updateCacheHave && time.Since(updateCacheAt) < updateCacheTTL {
			cached := updateCache
			updateCacheMu.Unlock()
			writeJSONResponse(w, cached)
			return
		}
		updateCacheMu.Unlock()

		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()
		current, latest, err := updateCheckFn(ctx)
		if err != nil {
			http.Error(w, fmt.Sprintf("update check failed: %s", err), http.StatusBadGateway)
			return
		}

		resp := updateCheckResponse{
			Current:   current,
			Latest:    latest,
			Available: update.IsNewer(latest),
		}
		updateCacheMu.Lock()
		updateCache, updateCacheAt, updateCacheHave = resp, time.Now(), true
		updateCacheMu.Unlock()
		writeJSONResponse(w, resp)
	}
}

// handleUpdateApply downloads and swaps in a newer release, then restarts
// the server so it comes back running the new binary with the current
// session restored.
//
// It is deliberately restricted to loopback clients: the server has no
// authentication and may bind to all interfaces, so a remotely reachable
// "replace the binary" endpoint would be a remote code execution primitive.
func handleUpdateApply(state *State) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !isLoopbackRequest(r) {
			http.Error(w, "update apply is restricted to localhost clients", http.StatusForbidden)
			return
		}

		// Bound the whole download+swap; on failure nothing has been
		// replaced (the swap is the last, atomic step).
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Minute)
		defer cancel()
		if err := updateApplyFn(ctx); err != nil {
			if errors.Is(err, errAlreadyUpToDate) {
				http.Error(w, err.Error(), http.StatusConflict)
				return
			}
			http.Error(w, fmt.Sprintf("update failed: %s", err), http.StatusInternalServerError)
			return
		}

		restoreFile, err := state.ExportState()
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_ = json.NewEncoder(w).Encode(map[string]bool{"restarting": true})

		select {
		case state.restartCh <- restoreFile:
		default:
			os.Remove(restoreFile) //nolint:errcheck
		}
	}
}

// isLoopbackRequest reports whether the request originated from the local
// machine.
func isLoopbackRequest(r *http.Request) bool {
	host := r.RemoteAddr
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}
