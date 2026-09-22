package build

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildStaticSiteSkipsNodeModulesAndGit(t *testing.T) {
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
	if err := BuildStaticSite(root, out); err != nil {
		t.Fatalf("BuildStaticSite: %v", err)
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
