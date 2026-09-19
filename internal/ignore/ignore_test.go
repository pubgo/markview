package ignore_test

import (
	"io/fs"
	"os"
	"path/filepath"
	"testing"

	"github.com/kooksee/markview/internal/ignore"
)

func TestWalk_SkipsGitignoreAndDotGit(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".gitignore"), []byte("node_modules/\nsecret.md\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "keep.md"), []byte("# keep"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "secret.md"), []byte("# secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "node_modules", "pkg"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "node_modules", "pkg", "x.md"), []byte("# x"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, ".git", "objects"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".git", "objects", "y.md"), []byte("# y"), 0o600); err != nil {
		t.Fatal(err)
	}

	seen := map[string]bool{}
	err := ignore.Walk(dir, func(abs string, d fs.DirEntry) error {
		if !d.IsDir() {
			rel, _ := filepath.Rel(dir, abs)
			seen[filepath.ToSlash(rel)] = true
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if !seen["keep.md"] {
		t.Fatalf("expected keep.md in %v", seen)
	}
	for _, banned := range []string{"secret.md", "node_modules/pkg/x.md", ".git/objects/y.md"} {
		if seen[banned] {
			t.Fatalf("should skip %s, got %v", banned, seen)
		}
	}
}

func TestIgnored_NestedGitignore(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "docs"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "docs", ".gitignore"), []byte("draft.md\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "docs", "ok.md"), []byte("# ok"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "docs", "draft.md"), []byte("# draft"), 0o600); err != nil {
		t.Fatal(err)
	}

	root := ignore.Root(dir)
	if !ignore.Ignored(root, filepath.Join(dir, "docs", "draft.md"), false) {
		t.Fatal("draft.md should be ignored")
	}
	if ignore.Ignored(root, filepath.Join(dir, "docs", "ok.md"), false) {
		t.Fatal("ok.md should not be ignored")
	}
}

func TestRoot_FindsGitDir(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, ".git"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "sub", "deep"), 0o700); err != nil {
		t.Fatal(err)
	}
	got := ignore.Root(filepath.Join(dir, "sub", "deep"))
	if got != dir {
		t.Fatalf("Root=%q, want %q", got, dir)
	}
}
