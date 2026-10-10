package update

import (
	"archive/tar"
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestIsNewer(t *testing.T) {
	tests := []struct {
		tag  string
		want bool
	}{
		{"v0.22.1", true},
		{"v0.23.0", true},
		{"v1.0.0", true},
		{"v0.22.0", false},
		{"v0.21.9", false},
		{"v0.100.0", true},     // numeric, not lexicographic
		{"v0.22.0-rc1", false}, // pre-release tags never count as newer
		{"not-a-version", false},
		{"", false},
	}
	for _, tt := range tests {
		if got := IsNewer(tt.tag); got != tt.want {
			t.Errorf("IsNewer(%q) = %v, want %v", tt.tag, got, tt.want)
		}
	}
}

func TestMatchAsset(t *testing.T) {
	rel := &Release{
		TagName: "v0.23.0",
		Assets: []Asset{
			{Name: "markview_0.23.0_checksums.txt"},
			{Name: "markview_v0.23.0_darwin_arm64.zip"},
			{Name: "markview_v0.23.0_linux_amd64.tar.gz"},
			{Name: "markview_v0.23.0_windows_amd64.tar.gz"},
		},
	}
	if got := matchAsset(rel, "darwin", "arm64"); got == nil || got.Name != "markview_v0.23.0_darwin_arm64.zip" {
		t.Errorf("darwin/arm64 asset = %v, want the zip asset", got)
	}
	if got := matchAsset(rel, "linux", "amd64"); got == nil || got.Name != "markview_v0.23.0_linux_amd64.tar.gz" {
		t.Errorf("linux/amd64 asset = %v, want the tar.gz asset", got)
	}
	if got := matchAsset(rel, "linux", "arm64"); got != nil {
		t.Errorf("linux/arm64 asset = %v, want nil (not built)", got)
	}
}

// releaseServer spins up an httptest server that mimics the GitHub release
// API and asset downloads for a single fake release. checksums is the raw
// checksums.txt payload, so tests can serve a deliberately wrong manifest.
func releaseServer(t *testing.T, tag, assetName string, archive []byte, checksums string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /repos/pubgo/markview/releases/latest", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"tag_name":%q,"assets":[`+
			`{"name":"checksums.txt","browser_download_url":%q},`+
			`{"name":%q,"browser_download_url":%q}]}`,
			tag,
			"/downloads/checksums.txt",
			assetName,
			"/downloads/"+assetName)
	})
	mux.HandleFunc("GET /downloads/", func(w http.ResponseWriter, r *http.Request) {
		switch filepath.Base(r.URL.Path) {
		case "checksums.txt":
			_, _ = w.Write([]byte(checksums))
		case assetName:
			_, _ = w.Write(archive)
		default:
			http.NotFound(w, r)
		}
	})
	return httptest.NewServer(mux)
}

// checksumLine renders a checksums.txt line for the given archive.
func checksumLine(t *testing.T, assetName string, archive []byte) string {
	t.Helper()
	return fmt.Sprintf("%x  %s\n", sha256.Sum256(archive), assetName)
}

// buildArchive produces a release archive in the platform's expected format
// containing a single executable named "markview" with the given content.
func buildArchive(t *testing.T, goos, content string) []byte {
	t.Helper()
	if goos == "darwin" {
		var buf bytes.Buffer
		zw := zip.NewWriter(&buf)
		w, err := zw.Create("markview")
		if err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte(content))
		if err := zw.Close(); err != nil {
			t.Fatal(err)
		}
		return buf.Bytes()
	}

	var buf bytes.Buffer
	gzw := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gzw)
	if err := tw.WriteHeader(&tar.Header{Name: "markview", Mode: 0o755, Size: int64(len(content))}); err != nil {
		t.Fatal(err)
	}
	_, _ = tw.Write([]byte(content))
	if err := tw.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gzw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestApplySwapsBinary(t *testing.T) {
	const newContent = "#!/bin/sh\necho new markview\n"
	goos := runtime.GOOS
	archive := buildArchive(t, goos, newContent)
	assetName := fmt.Sprintf("markview_v9.9.9_%s_%s", goos, runtime.GOARCH)
	if goos == "darwin" {
		assetName += ".zip"
	} else {
		assetName += ".tar.gz"
	}

	ts := releaseServer(t, "v9.9.9", assetName, archive, checksumLine(t, assetName, archive))
	defer ts.Close()

	exe := filepath.Join(t.TempDir(), "markview")
	if err := os.WriteFile(exe, []byte("old binary"), 0o755); err != nil { //nolint:gosec // test fixture
		t.Fatal(err)
	}

	client := &Client{BaseURL: ts.URL, HTTP: ts.Client()}
	rel, err := client.Latest(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !IsNewer(rel.TagName) {
		t.Fatalf("release %s should be newer", rel.TagName)
	}
	if err := client.applyTo(context.Background(), exe, rel); err != nil {
		t.Fatal(err)
	}

	got, err := os.ReadFile(exe) //nolint:gosec // test fixture
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != newContent {
		t.Errorf("binary not swapped: got %q, want %q", got, newContent)
	}
	info, err := os.Stat(exe)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm()&0o100 == 0 {
		t.Errorf("swapped binary lost the executable bit: %v", info.Mode().Perm())
	}
	// The staging files must not linger next to the binary.
	entries, _ := os.ReadDir(filepath.Dir(exe))
	for _, e := range entries {
		if e.Name() != "markview" {
			t.Errorf("staging file %q left behind", e.Name())
		}
	}
}

func TestApplyRejectsChecksumMismatch(t *testing.T) {
	goos := runtime.GOOS
	assetName := fmt.Sprintf("markview_v9.9.9_%s_%s", goos, runtime.GOARCH)
	if goos == "darwin" {
		assetName += ".zip"
	} else {
		assetName += ".tar.gz"
	}

	// Serve a different archive than the checksums describe, simulating a
	// tampered or corrupted download.
	ts := releaseServer(t, "v9.9.9", assetName, buildArchive(t, goos, "tampered payload"),
		fmt.Sprintf("deadbeef  %s\n", assetName))
	defer ts.Close()

	exe := filepath.Join(t.TempDir(), "markview")
	if err := os.WriteFile(exe, []byte("old binary"), 0o755); err != nil { //nolint:gosec // test fixture
		t.Fatal(err)
	}

	client := &Client{BaseURL: ts.URL, HTTP: ts.Client()}
	rel, err := client.Latest(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := client.applyTo(context.Background(), exe, rel); err == nil {
		t.Fatal("apply should fail on checksum mismatch")
	}

	got, err := os.ReadFile(exe) //nolint:gosec // test fixture
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "old binary" {
		t.Errorf("binary was modified despite checksum failure: got %q", got)
	}
}

func TestApplyWithoutMatchingAsset(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"tag_name":"v9.9.9","assets":[]}`))
	}))
	defer ts.Close()

	exe := filepath.Join(t.TempDir(), "markview")
	if err := os.WriteFile(exe, []byte("old"), 0o755); err != nil { //nolint:gosec // test fixture
		t.Fatal(err)
	}

	client := &Client{BaseURL: ts.URL, HTTP: ts.Client()}
	rel, err := client.Latest(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := client.applyTo(context.Background(), exe, rel); err == nil {
		t.Fatal("apply should fail when no asset matches the platform")
	}
}

func TestExtractBinaryBothFormats(t *testing.T) {
	for _, goos := range []string{"darwin", "linux"} {
		t.Run(goos, func(t *testing.T) {
			dir := t.TempDir()
			archivePath := filepath.Join(dir, "archive")
			dest := filepath.Join(dir, "markview")
			if err := os.WriteFile(archivePath, buildArchive(t, goos, "payload"), 0o600); err != nil { //nolint:gosec // test fixture
				t.Fatal(err)
			}
			if err := extractBinary(archivePath, goos, dest); err != nil {
				t.Fatal(err)
			}
			got, err := os.ReadFile(dest) //nolint:gosec // test fixture
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != "payload" {
				t.Errorf("extracted content = %q, want %q", got, "payload")
			}
		})
	}
}
