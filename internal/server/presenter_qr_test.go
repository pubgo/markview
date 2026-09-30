package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHandlePresenterQR(t *testing.T) {
	handler := handlePresenterQR()

	t.Run("encodes url to png", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/_/api/presenter/qr?text=http://192.168.1.15:6275/?presenter=1", nil)
		rec := httptest.NewRecorder()
		handler(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("got %d body=%q", rec.Code, rec.Body.String())
		}
		ct := rec.Header().Get("Content-Type")
		if ct != "image/png" {
			t.Fatalf("content type %q", ct)
		}
		// PNG magic bytes
		png := []byte{0x89, 'P', 'N', 'G'}
		if string(rec.Body.Bytes()[:4]) != string(png) {
			t.Fatal("response is not a PNG")
		}
	})

	t.Run("rejects non http text", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/_/api/presenter/qr?text=javascript:alert(1)", nil)
		rec := httptest.NewRecorder()
		handler(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("got %d want 400", rec.Code)
		}
	})

	t.Run("rejects missing text", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/_/api/presenter/qr", nil)
		rec := httptest.NewRecorder()
		handler(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("got %d want 400", rec.Code)
		}
	})
}

func TestHandleLANHint(t *testing.T) {
	req := httptest.NewRequest("GET", "http://localhost:6279/_/api/lan-hint", nil)
	rec := httptest.NewRecorder()
	handleLANHint()(rec, req)

	if rec.Code == http.StatusNotFound {
		t.Skip("no LAN address on this machine")
	}
	if rec.Code != http.StatusOK {
		t.Fatalf("got %d body=%q", rec.Code, rec.Body.String())
	}
	var hint struct {
		IP   string `json:"ip"`
		Port string `json:"port"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &hint); err != nil {
		t.Fatalf("bad json: %v", err)
	}
	if hint.IP == "" {
		t.Fatal("empty ip")
	}
	if hint.Port != "6279" {
		t.Fatalf("port = %q, want 6279 from request host", hint.Port)
	}
}
