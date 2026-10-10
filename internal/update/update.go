// Package update implements self-updating for markview: it queries the latest
// GitHub release, downloads the archive matching the current platform,
// verifies its checksum, and atomically replaces the running binary. The
// caller is responsible for restarting the process afterwards.
package update

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/pubgo/markview/version"
)

const (
	// DefaultBaseURL is the GitHub API root used to query releases.
	DefaultBaseURL = "https://api.github.com"
	// releasesAPIPath is the API path for the latest release of this project.
	releasesAPIPath = "/repos/pubgo/markview/releases/latest"
	// downloadTimeout bounds a single asset download (archives are small).
	downloadTimeout = 5 * time.Minute
	// requestTimeout bounds metadata requests (release JSON, checksums).
	requestTimeout = 15 * time.Second
	// binaryName is both the executable name inside release archives and the
	// project name used by GoReleaser asset names.
	binaryName = "markview"
)

// Release is the subset of the GitHub release payload the updater needs.
type Release struct {
	TagName string  `json:"tag_name"`
	Assets  []Asset `json:"assets"`
}

// Asset is a single downloadable file attached to a release.
type Asset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// Client queries releases and applies updates. The zero value uses the
// default GitHub API base and the ambient MARKVIEW_UPDATE_SOURCE override.
type Client struct {
	// BaseURL is the API root. Override it to point at a mirror or a test
	// server; asset download URLs always come from the release payload.
	BaseURL string
	// HTTP sends all requests. A client with a sane timeout is used if nil.
	HTTP *http.Client
}

// NewClient builds a Client, falling back to MARKVIEW_UPDATE_SOURCE when no
// explicit base URL is given.
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = os.Getenv("MARKVIEW_UPDATE_SOURCE")
	}
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return &Client{BaseURL: baseURL}
}

// Latest returns the most recent published release.
func (c *Client) Latest(ctx context.Context) (*Release, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimSuffix(c.BaseURL, "/")+releasesAPIPath, nil) //nolint:gosec // base URL is operator configuration
	if err != nil {
		return nil, fmt.Errorf("cannot build release request: %w", err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := c.httpClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("cannot query latest release: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("release query returned %s", resp.Status)
	}

	var rel Release
	if err := json.NewDecoder(resp.Body).Decode(&rel); err != nil {
		return nil, fmt.Errorf("cannot decode release payload: %w", err)
	}
	if rel.TagName == "" {
		return nil, fmt.Errorf("release payload has no tag name")
	}
	return &rel, nil
}

// IsNewer reports whether the release tag is a newer semantic version than
// the running build. Tags that do not parse as major.minor.patch are never
// treated as newer, so pre-release or odd tags stay conservative.
func IsNewer(tag string) bool {
	return compareSemver(tag, version.Version) > 0
}

func compareSemver(a, b string) int {
	pa, okA := parseSemver(a)
	pb, okB := parseSemver(b)
	if !okA || !okB {
		return 0
	}
	for i := range pa {
		if pa[i] != pb[i] {
			if pa[i] > pb[i] {
				return 1
			}
			return -1
		}
	}
	return 0
}

func parseSemver(v string) ([3]int, bool) {
	var nums [3]int
	parts := strings.Split(strings.TrimPrefix(strings.TrimSpace(v), "v"), ".")
	if len(parts) == 0 || len(parts) > 3 {
		return nums, false
	}
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return nums, false
		}
		nums[i] = n
	}
	return nums, true
}

// matchAsset picks the release archive built for the given platform. Asset
// names follow the GoReleaser template markview_v{version}_{os}_{arch} with a
// .zip suffix on darwin and .tar.gz elsewhere.
func matchAsset(rel *Release, goos, goarch string) *Asset {
	suffix := ".tar.gz"
	if goos == "darwin" {
		suffix = ".zip"
	}
	marker := "_" + goos + "_" + goarch + "."
	for i := range rel.Assets {
		name := rel.Assets[i].Name
		if strings.HasPrefix(name, binaryName+"_v") && strings.Contains(name, marker) && strings.HasSuffix(name, suffix) {
			return &rel.Assets[i]
		}
	}
	return nil
}

// Apply downloads the release archive for the running platform, verifies its
// sha256 against the release checksums.txt, and atomically replaces the
// currently running binary. Running processes keep the old image until they
// are restarted.
func (c *Client) Apply(ctx context.Context, rel *Release) error {
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("cannot locate the running binary: %w", err)
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return c.applyTo(ctx, exe, rel)
}

func (c *Client) applyTo(ctx context.Context, exePath string, rel *Release) error {
	asset := matchAsset(rel, runtime.GOOS, runtime.GOARCH)
	if asset == nil {
		return fmt.Errorf("release %s has no archive for %s/%s", rel.TagName, runtime.GOOS, runtime.GOARCH)
	}

	ctx, cancel := context.WithTimeout(ctx, downloadTimeout)
	defer cancel()

	checksums, err := c.download(ctx, checksumsAsset(rel))
	if err != nil {
		return fmt.Errorf("cannot download checksums: %w", err)
	}

	archive, err := c.download(ctx, asset.BrowserDownloadURL)
	if err != nil {
		return fmt.Errorf("cannot download %s: %w", asset.Name, err)
	}
	if err := verifyChecksum(archive, checksums, asset.Name); err != nil {
		return err
	}

	workDir := filepath.Dir(exePath)
	archiveFile := filepath.Join(workDir, "markview.update.archive")
	newBinary := filepath.Join(workDir, binaryName+".update.new")
	if err := os.WriteFile(archiveFile, archive, 0o600); err != nil { //nolint:gosec // content is checksum-verified above
		return fmt.Errorf("cannot stage archive: %w", err)
	}
	defer os.Remove(archiveFile) //nolint:errcheck // best-effort cleanup
	if err := extractBinary(archiveFile, runtime.GOOS, newBinary); err != nil {
		os.Remove(newBinary) //nolint:errcheck // best-effort cleanup
		return fmt.Errorf("cannot extract %s: %w", asset.Name, err)
	}

	if err := swapBinary(newBinary, exePath); err != nil {
		os.Remove(newBinary) //nolint:errcheck // best-effort cleanup
		return err
	}
	return nil
}

// checksumsAsset returns the release asset named checksums.txt, if attached.
func checksumsAsset(rel *Release) string {
	for _, a := range rel.Assets {
		if a.Name == "checksums.txt" {
			return a.BrowserDownloadURL
		}
	}
	return ""
}

func (c *Client) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: requestTimeout}
}

func (c *Client) download(ctx context.Context, url string) ([]byte, error) {
	if url == "" {
		return nil, fmt.Errorf("no download URL")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.resolveURL(url), nil) //nolint:gosec // URL comes from the configured release source
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download returned %s", resp.Status)
	}
	return io.ReadAll(resp.Body)
}

// resolveURL makes asset URLs usable with non-GitHub sources: absolute URLs
// pass through unchanged, while relative paths resolve against the API base.
func (c *Client) resolveURL(url string) string {
	if url == "" || strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		return url
	}
	if !strings.HasPrefix(url, "/") {
		url = "/" + url
	}
	return strings.TrimSuffix(c.BaseURL, "/") + url
}

// verifyChecksum checks the downloaded archive against the sha256 sums in
// the GoReleaser checksums.txt manifest ("<hex>  <filename>" per line).
func verifyChecksum(archive, checksums []byte, assetName string) error {
	want := fmt.Sprintf("%x", sha256.Sum256(archive))
	for _, line := range strings.Split(string(checksums), "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && fields[1] == assetName {
			if !strings.EqualFold(fields[0], want) {
				return fmt.Errorf("checksum mismatch for %s: got %s, want %s", assetName, want, fields[0])
			}
			return nil
		}
	}
	return fmt.Errorf("checksum for %s not found in checksums.txt", assetName)
}

// swapBinary moves the staged binary into place. Unix filesystems allow
// renaming over a running executable; Windows does not, so the running image
// is shuffled aside first and rolled back if the swap fails.
func swapBinary(newPath, target string) error {
	if runtime.GOOS != "windows" {
		return os.Rename(newPath, target)
	}
	oldPath := target + ".old"
	_ = os.Remove(oldPath)
	if err := os.Rename(target, oldPath); err != nil {
		return fmt.Errorf("cannot move the running binary aside: %w", err)
	}
	if err := os.Rename(newPath, target); err != nil {
		if restoreErr := os.Rename(oldPath, target); restoreErr != nil {
			return fmt.Errorf("swap failed (%w) and rollback also failed (%w)", err, restoreErr)
		}
		return fmt.Errorf("swap failed: %w", err)
	}
	_ = os.Remove(oldPath)
	return nil
}
