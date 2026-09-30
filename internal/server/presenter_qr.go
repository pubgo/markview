package server

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"

	"github.com/skip2/go-qrcode"
)

// handlePresenterQR serves a PNG QR code encoding ?text= (http/https URL,
// max 512 chars) so users can scan the presenter remote URL with a phone.
func handlePresenterQR() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		text := strings.TrimSpace(r.URL.Query().Get("text"))
		if len(text) == 0 || len(text) > 512 {
			http.Error(w, "text must be 1..512 chars", http.StatusBadRequest)
			return
		}
		if !strings.HasPrefix(text, "http://") && !strings.HasPrefix(text, "https://") {
			http.Error(w, "text must be an http(s) URL", http.StatusBadRequest)
			return
		}
		png, err := qrcode.Encode(text, qrcode.Medium, 256)
		if err != nil {
			http.Error(w, "failed to encode QR", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "no-store")
		//nolint:gosec // PNG bytes produced by qrcode.Encode, not request text
		_, _ = w.Write(png)
	}
}

// handleLANHint reports a LAN-reachable address of this server so the
// frontend can build presenter URLs that work from other devices. The port
// comes from the request Host (what the client actually used); the IP is the
// first private IPv4 of the machine's interfaces.
func handleLANHint() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		_, port, err := net.SplitHostPort(r.Host)
		if err != nil || port == "" {
			port = "80"
			if r.TLS != nil {
				port = "443"
			}
		}
		ip := lanIPv4()
		w.Header().Set("Content-Type", "application/json")
		enc := json.NewEncoder(w)
		if ip == "" {
			w.WriteHeader(http.StatusNotFound)
			enc.Encode(struct{}{}) //nolint:errcheck
			return
		}
		enc.Encode(map[string]string{"ip": ip, "port": port}) //nolint:errcheck
	}
}

func lanIPv4() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ""
	}
	var fallback string
	for _, addr := range addrs {
		ipnet, ok := addr.(*net.IPNet)
		if !ok || ipnet.IP.To4() == nil || ipnet.IP.IsLoopback() {
			continue
		}
		ip := ipnet.IP.To4()
		private := ip[0] == 10 ||
			(ip[0] == 172 && ip[1] >= 16 && ip[1] <= 31) ||
			(ip[0] == 192 && ip[1] == 168)
		if private {
			return ip.String()
		}
		if fallback == "" {
			fallback = ip.String()
		}
	}
	return fallback
}
