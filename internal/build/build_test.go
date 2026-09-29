package build

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStaticSiteSkipsNodeModulesAndGit(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	mustWrite := func(rel, body string) {
		t.Helper()
		path := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("mkdir: %v", err)
		}
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			t.Fatalf("write: %v", err)
		}
	}

	mustWrite("README.md", "# Root\n")
	mustWrite("docs/guide.md", "# Guide\n")
	mustWrite("node_modules/pkg/README.md", "# Dep\n")
	mustWrite(".git/hooks/README.md", "# Git\n")

	out := filepath.Join(root, "site")
	if err := StaticSite(root, out, "", ""); err != nil {
		t.Fatalf("StaticSite: %v", err)
	}

	index := filepath.Join(out, "index.html")
	data, err := os.ReadFile(index)
	if err != nil {
		t.Fatalf("read index: %v", err)
	}
	html := string(data)
	if !strings.Contains(html, "guide.md") && !strings.Contains(html, "README.md") {
		t.Fatalf("expected root markdown paths in embedded data")
	}
	if strings.Contains(html, "node_modules") {
		t.Fatalf("static site embedded node_modules paths")
	}
	if strings.Contains(html, ".git/hooks") {
		t.Fatalf("static site embedded .git paths")
	}
}

func TestStaticSiteInjectsBasePath(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	path := filepath.Join(root, "README.md")
	if err := os.WriteFile(path, []byte("# Root\n"), 0o600); err != nil {
		t.Fatalf("write: %v", err)
	}

	out := filepath.Join(root, "site")
	if err := StaticSite(root, out, "/markview", ""); err != nil {
		t.Fatalf("StaticSite: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(out, "index.html"))
	if err != nil {
		t.Fatalf("read index: %v", err)
	}
	html := string(data)
	if !strings.Contains(html, `window.__MARKVIEW_BASE_PATH__="/markview"`) {
		t.Fatalf("expected base path injection in index.html")
	}
}

func TestStaticSiteGroupFilter(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	mustWrite := func(rel, body string) {
		t.Helper()
		path := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatalf("mkdir: %v", err)
		}
		if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
			t.Fatalf("write: %v", err)
		}
	}
	mustWrite("design/a.md", "# A\n")
	mustWrite("design/sub/b.md", "# B\n")
	mustWrite("api/c.md", "# C\n")
	mustWrite("top.md", "# Top\n")

	out := filepath.Join(t.TempDir(), "site")
	if err := StaticSite(root, out, "", "design"); err != nil {
		t.Fatalf("StaticSite: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(out, "index.html"))
	if err != nil {
		t.Fatalf("read index: %v", err)
	}
	html := string(data)
	if !strings.Contains(html, "static-data-not-found-placeholder") {
		t.Log("group filter assertions rely on embedded data markers")
	}
	for _, want := range []string{"design/a.md", "design/sub/b.md"} {
		if !strings.Contains(html, want) {
			t.Fatalf("expected %q in embedded data", want)
		}
	}
	for _, banned := range []string{"api/c.md", "top.md"} {
		if strings.Contains(html, banned) {
			t.Fatalf("group export leaked %q", banned)
		}
	}
	if !strings.Contains(html, `"name":"design"`) {
		t.Fatalf("expected exported group to be named %q", "design")
	}
}

func TestStaticSiteGroupErrors(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "design"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}

	t.Run("unknown group", func(t *testing.T) {
		if err := StaticSite(root, filepath.Join(t.TempDir(), "site"), "", "nope"); err == nil {
			t.Fatal("expected error for unknown group")
		}
	})

	t.Run("group without markdown", func(t *testing.T) {
		if err := StaticSite(root, filepath.Join(t.TempDir(), "site"), "", "design"); err == nil {
			t.Fatal("expected error for group without markdown files")
		}
	})
}
