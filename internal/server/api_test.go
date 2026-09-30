package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/k1LoW/donegroup"
)

// apiTestHarness wires a State with real markdown files and an HTTP handler.
type apiTestHarness struct {
	t      *testing.T
	root   string
	state  *State
	server *httptest.Server
}

func newAPITestHarness(t *testing.T) *apiTestHarness {
	t.Helper()
	ctx, cancel := donegroup.WithCancel(context.Background())
	t.Cleanup(cancel)

	s := NewState(ctx)
	root := t.TempDir()
	mustWriteAPIFile(t, filepath.Join(root, "docs", "guide.md"), "# Guide\n\nsee [other](other.md)\n")
	mustWriteAPIFile(t, filepath.Join(root, "docs", "other.md"), "# Other\n")
	mustWriteAPIFile(t, filepath.Join(root, "api", "reference.md"), "# Reference\n")

	for _, p := range []string{
		filepath.Join(root, "docs", "guide.md"),
		filepath.Join(root, "api", "reference.md"),
	} {
		s.AddFile(p, DefaultGroup)
	}

	return &apiTestHarness{t: t, root: root, state: s, server: httptest.NewServer(NewHandler(s))}
}

func mustMarshal(t *testing.T, v any) []byte {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return raw
}

func mustWriteAPIFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func (h *apiTestHarness) fetch(path string) *httptest.ResponseRecorder {
	h.t.Helper()
	req := httptest.NewRequest("GET", h.server.URL+path, nil)
	rec := httptest.NewRecorder()
	NewHandler(h.state).ServeHTTP(rec, req)
	return rec
}

func (h *apiTestHarness) fileIDs() []string {
	h.t.Helper()
	var groups []struct {
		Files []struct {
			ID string `json:"id"`
		} `json:"files"`
	}
	if err := json.Unmarshal(h.fetch("/_/api/groups").Body.Bytes(), &groups); err != nil {
		h.t.Fatal(err)
	}
	var ids []string
	for _, f := range groups[0].Files {
		ids = append(ids, f.ID)
	}
	return ids
}

func (h *apiTestHarness) do(method, path, body string) *httptest.ResponseRecorder {
	h.t.Helper()
	req := httptest.NewRequest(method, h.server.URL+path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	NewHandler(h.state).ServeHTTP(rec, req)
	return rec
}

func TestAPIGroups(t *testing.T) {
	h := newAPITestHarness(t)
	rec := h.fetch("/_/api/groups")
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d body=%q", rec.Code, rec.Body.String())
	}
	var groups []struct {
		Files []struct {
			ID string `json:"id"`
		} `json:"files"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &groups); err != nil {
		t.Fatalf("bad json: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	if len(groups[0].Files) != 2 {
		t.Fatalf("expected 2 files in default group, got %d", len(groups[0].Files))
	}
}

func TestAPIFileContent(t *testing.T) {
	h := newAPITestHarness(t)
	// Locate a file id via /_/api/groups.
	var groups []struct {
		Files []struct {
			ID string `json:"id"`
		} `json:"files"`
	}
	if err := json.Unmarshal(h.fetch("/_/api/groups").Body.Bytes(), &groups); err != nil {
		t.Fatal(err)
	}
	id := groups[0].Files[0].ID

	rec := h.fetch("/_/api/files/" + id + "/content")
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d", rec.Code)
	}
	var content struct {
		Content string `json:"content"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &content); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(content.Content, "# Guide") {
		t.Fatalf("unexpected content %q", content.Content)
	}

	t.Run("unknown id is 404", func(t *testing.T) {
		if rec := h.fetch("/_/api/files/nope/content"); rec.Code != http.StatusNotFound {
			t.Fatalf("got %d want 404", rec.Code)
		}
	})
}

func TestAPIGraphAndOutline(t *testing.T) {
	h := newAPITestHarness(t)

	var graph struct {
		Nodes []map[string]any `json:"nodes"`
		Edges []map[string]any `json:"edges"`
	}
	if err := json.Unmarshal(h.fetch("/_/api/graph").Body.Bytes(), &graph); err != nil {
		t.Fatal(err)
	}
	if len(graph.Nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(graph.Nodes))
	}
	// guide.md links to other.md, but other.md is not in the session: no edge.
	if len(graph.Edges) != 0 {
		t.Fatalf("expected no edges (other.md not in session), got %d", len(graph.Edges))
	}

	var outline struct {
		Files []map[string]any `json:"files"`
	}
	if err := json.Unmarshal(h.fetch("/_/api/outline").Body.Bytes(), &outline); err != nil {
		t.Fatal(err)
	}
	if len(outline.Files) != 2 {
		t.Fatalf("expected 2 outline files, got %d", len(outline.Files))
	}
}

func TestAPIReorder(t *testing.T) {
	h := newAPITestHarness(t)
	ids := h.fileIDs()
	if len(ids) != 2 {
		t.Fatalf("setup: expected 2 files, got %d", len(ids))
	}

	reversed := []string{ids[1], ids[0]}
	body := mustMarshal(t, map[string]any{"group": DefaultGroup, "fileIds": reversed})
	if rec := h.do("PUT", "/_/api/reorder", string(body)); rec.Code != http.StatusNoContent {
		t.Fatalf("reorder got %d body=%q", rec.Code, rec.Body.String())
	}
	after := h.fileIDs()
	if after[0] != reversed[0] || after[1] != reversed[1] {
		t.Fatalf("order not applied: %v", after)
	}

	t.Run("mismatched ids are rejected", func(t *testing.T) {
		body := mustMarshal(t, map[string]any{"group": DefaultGroup, "fileIds": []string{"nope"}})
		if rec := h.do("PUT", "/_/api/reorder", string(body)); rec.Code == http.StatusOK {
			t.Fatal("expected non-200 for unknown file id")
		}
	})
}

func TestAPIPatternsLifecycle(t *testing.T) {
	h := newAPITestHarness(t)
	addBody := mustMarshal(t, map[string]any{
		"pattern": filepath.Join(h.root, "docs", "*.md"),
		"group":   "watched",
	})
	rec := h.do("POST", "/_/api/patterns", string(addBody))
	if rec.Code != http.StatusOK {
		t.Fatalf("add pattern got %d body=%q", rec.Code, rec.Body.String())
	}
	var added struct {
		Files []map[string]any `json:"files"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &added); err != nil {
		t.Fatal(err)
	}
	if len(added.Files) != 2 {
		t.Fatalf("expected glob to match 2 docs files, got %d", len(added.Files))
	}

	if got := len(h.state.Patterns()); got != 1 {
		t.Fatalf("expected 1 pattern, got %d", got)
	}
	if got := h.state.PatternsForGroup("watched"); len(got) != 1 {
		t.Fatalf("expected 1 pattern for group, got %d", len(got))
	}

	delBody := mustMarshal(t, map[string]any{
		"pattern": filepath.Join(h.root, "docs", "*.md"),
		"group":   "watched",
	})
	req := httptest.NewRequest("DELETE", h.server.URL+"/_/api/patterns", bytes.NewReader(delBody))
	rec2 := httptest.NewRecorder()
	NewHandler(h.state).ServeHTTP(rec2, req)
	if rec2.Code != http.StatusNoContent {
		t.Fatalf("delete got %d body=%q", rec2.Code, rec2.Body.String())
	}
	if got := len(h.state.Patterns()); got != 0 {
		t.Fatalf("pattern not removed: %d left", got)
	}
}

func TestAPIMoveFile(t *testing.T) {
	h := newAPITestHarness(t)
	id := h.fileIDs()[0]

	body := mustMarshal(t, map[string]any{"group": "design"})
	req := httptest.NewRequest("PUT", h.server.URL+"/_/api/files/"+id+"/group", strings.NewReader(string(body)))
	rec := httptest.NewRecorder()
	NewHandler(h.state).ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("move got %d body=%q", rec.Code, rec.Body.String())
	}
	if got := h.state.FindGroupForFile(id); got != "design" {
		t.Fatalf("file group = %q, want design", got)
	}
}

func TestAPIUploadFile(t *testing.T) {
	h := newAPITestHarness(t)
	body := mustMarshal(t, map[string]any{
		"name":    "notes.md",
		"content": "# Uploaded\n",
		"group":   DefaultGroup,
	})
	rec := h.do("POST", "/_/api/files/upload", string(body))
	if rec.Code != http.StatusOK {
		t.Fatalf("upload got %d body=%q", rec.Code, rec.Body.String())
	}
	var found *FileEntry
	for _, g := range h.state.Groups() {
		for _, f := range g.Files {
			if f.Name == "notes.md" && f.Uploaded {
				found = f
			}
		}
	}
	if found == nil {
		t.Fatal("uploaded file not found in groups")
	}
}

func TestAPIStatusAndShutdown(t *testing.T) {
	h := newAPITestHarness(t)

	if rec := h.fetch("/_/api/status"); rec.Code != http.StatusOK {
		t.Fatalf("status got %d", rec.Code)
	}

	done := make(chan struct{})
	go func() {
		// handleShutdown signals state.ShutdownCh; the server loop would exit.
		rec := h.do("POST", "/_/api/shutdown", "")
		if rec.Code != http.StatusAccepted {
			t.Errorf("shutdown got %d", rec.Code)
		}
		close(done)
	}()
	select {
	case <-h.state.ShutdownCh():
	case <-time.After(2 * time.Second):
		t.Fatal("shutdown channel not signaled")
	}
	<-done
}

func TestStateHelpers(t *testing.T) {
	h := newAPITestHarness(t)
	s := h.state

	t.Run("FindFile and FindGroupForFile", func(t *testing.T) {
		ids := s.Groups()[0].Files
		if len(ids) == 0 {
			t.Fatal("setup: no files")
		}
		id := ids[0].ID
		if s.FindFile(id) == nil {
			t.Fatal("FindFile returned nil")
		}
		if got := s.FindGroupForFile(id); got != DefaultGroup {
			t.Fatalf("group = %q", got)
		}
		if s.FindFile("missing") != nil {
			t.Fatal("FindFile should return nil for unknown id")
		}
	})

	t.Run("ResolveGroupName", func(t *testing.T) {
		got, err := ResolveGroupName("design")
		if err != nil || got != "design" {
			t.Fatalf("got %q err=%v", got, err)
		}
		if _, err := ResolveGroupName("../escape"); err == nil {
			t.Fatal("expected error for path traversal group name")
		}
		if _, err := ResolveGroupName("a//b"); err == nil {
			t.Fatal("expected error for consecutive slashes")
		}
	})

	t.Run("FileID deterministic", func(t *testing.T) {
		a := FileID("/tmp/x/a.md")
		b := FileID("/tmp/x/b.md")
		if a == b {
			t.Fatal("different paths must map to different ids")
		}
		if a != FileID("/tmp/x/a.md") {
			t.Fatal("FileID must be deterministic")
		}
	})

	t.Run("ExportState writes restore file", func(t *testing.T) {
		path, err := s.ExportState()
		if err != nil {
			t.Fatal(err)
		}
		defer os.Remove(path)
		raw, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var rd RestoreData
		if err := json.Unmarshal(raw, &rd); err != nil {
			t.Fatal(err)
		}
		if len(rd.Groups[DefaultGroup]) != 2 {
			t.Fatalf("exported %d files", len(rd.Groups[DefaultGroup]))
		}
	})

	t.Run("AddUploadedFile joins group", func(t *testing.T) {
		entry := s.AddUploadedFile("up.md", "# Up\n", DefaultGroup)
		if entry == nil || !entry.Uploaded {
			t.Fatal("AddUploadedFile returned nil or not uploaded")
		}
		if got := s.FindGroupForFile(entry.ID); got != DefaultGroup {
			t.Fatalf("group = %q", got)
		}
	})
}
