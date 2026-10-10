package server

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/k1LoW/donegroup"
)

func TestUpdateCheckEndpoint(t *testing.T) {
	origCheck := updateCheckFn
	t.Cleanup(func() { updateCheckFn = origCheck })

	updateCheckFn = func(_ context.Context) (string, string, error) {
		return "0.22.0", "v0.23.0", nil
	}
	resetUpdateCache()

	h := handleUpdateCheck()
	req := httptest.NewRequest(http.MethodGet, "/_/api/update/check", nil)
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var resp updateCheckResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if resp.Current != "0.22.0" || resp.Latest != "v0.23.0" || !resp.Available {
		t.Errorf("unexpected payload: %+v", resp)
	}

	// A failing check surfaces as a bad gateway, not a panic.
	updateCheckFn = func(_ context.Context) (string, string, error) {
		return "", "", errors.New("offline")
	}
	resetUpdateCache()
	rec = httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Errorf("failing check status = %d, want %d", rec.Code, http.StatusBadGateway)
	}
}

// resetUpdateCache drops the cached check result between test phases.
func resetUpdateCache() {
	updateCacheMu.Lock()
	defer updateCacheMu.Unlock()
	updateCacheHave = false
}

func TestUpdateApplyRejectsRemoteClients(t *testing.T) {
	ctx, cancel := donegroup.WithCancel(context.Background())
	t.Cleanup(cancel)
	state := NewState(ctx)
	h := handleUpdateApply(state)

	req := httptest.NewRequest(http.MethodPost, "/_/api/update/apply", nil)
	req.RemoteAddr = "192.168.1.10:52344"
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("remote apply status = %d, want %d", rec.Code, http.StatusForbidden)
	}

	// Loopback clients pass the gate (the stub apply fails below, but with a
	// non-403 status proving the restriction did not trigger).
	origApply := updateApplyFn
	t.Cleanup(func() { updateApplyFn = origApply })
	updateApplyFn = func(_ context.Context) error { return errAlreadyUpToDate }

	req = httptest.NewRequest(http.MethodPost, "/_/api/update/apply", nil)
	req.RemoteAddr = "127.0.0.1:52344"
	rec = httptest.NewRecorder()
	h(rec, req)
	if rec.Code != http.StatusConflict {
		t.Errorf("loopback apply status = %d, want %d (conflict for up-to-date)", rec.Code, http.StatusConflict)
	}
}

func TestUpdateApplyRestartsServer(t *testing.T) {
	ctx, cancel := donegroup.WithCancel(context.Background())
	defer cancel()
	state := NewState(ctx)

	origApply := updateApplyFn
	t.Cleanup(func() { updateApplyFn = origApply })

	applied := false
	updateApplyFn = func(_ context.Context) error {
		applied = true
		return nil
	}

	h := handleUpdateApply(state)
	req := httptest.NewRequest(http.MethodPost, "/_/api/update/apply", nil)
	req.RemoteAddr = "127.0.0.1:52344"
	rec := httptest.NewRecorder()
	h(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("apply status = %d, want %d", rec.Code, http.StatusAccepted)
	}
	if !applied {
		t.Error("apply function was not invoked")
	}

	select {
	case restoreFile := <-state.RestartCh():
		if restoreFile == "" {
			t.Error("restart signal carried an empty restore file path")
		}
	case <-time.After(time.Second):
		t.Fatal("restart was not signaled after a successful apply")
	}
}

func TestIsLoopbackRequest(t *testing.T) {
	tests := []struct {
		remoteAddr string
		want       bool
	}{
		{"127.0.0.1:52344", true},
		{"[::1]:52344", true},
		{"localhost:52344", false}, // unresolved hostnames never count
		{"192.168.1.10:52344", false},
		{"", false},
	}
	for _, tt := range tests {
		req := httptest.NewRequest(http.MethodPost, "/_/api/update/apply", nil)
		req.RemoteAddr = tt.remoteAddr
		if got := isLoopbackRequest(req); got != tt.want {
			t.Errorf("isLoopbackRequest(%q) = %v, want %v", tt.remoteAddr, got, tt.want)
		}
	}
}
