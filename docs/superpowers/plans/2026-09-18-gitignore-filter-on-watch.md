# Gitignore Filter on Watch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prune watch/glob file discovery using project `.gitignore` rules so ignored paths are neither added nor watched.

**Architecture:** Thin `internal/ignore` wrapper around `github.com/git-pkgs/gitignore` (Match + pattern loading only; no hand-rolled wildmatch). Server `AddPattern` / dir-watch / `matchAndAddFile` call this package. Explicit `AddFile` stays unfiltered. Use `gitignore.New("")` + `AddFromFile` so only project `.gitignore` files apply (not global excludes / `.git/info/exclude`). Always skip `.git/`.

**Tech Stack:** Go 1.26, `github.com/git-pkgs/gitignore` v1.3.0+, existing `doublestar` for glob match, `fsnotify` watch loop.

## Global Constraints

- Filter **only** glob/watch discovery (`AddPattern`, watch auto-add, recursive dir scan/watch registration).
- Explicit CLI/API `AddFile` and uploads are **not** filtered.
- Ignore sources: project `.gitignore` only (ancestors from git root or base + nested); always skip `.git/`.
- Prefer library reuse; do not reimplement gitignore matching.
- No CLI flag to disable filtering in this change.

---

### Task 1: `internal/ignore` wrapper + unit tests

**Files:**
- Create: `internal/ignore/ignore.go`
- Create: `internal/ignore/ignore_test.go`
- Modify: `go.mod` / `go.sum` (add `github.com/git-pkgs/gitignore`)

**Interfaces:**
- Produces:
  - `func Root(start string) string` — walk up for a `.git` directory; if none, return cleaned `start`
  - `func Walk(start string, fn func(absPath string, d fs.DirEntry) error) error` — pruned walk from `start`, loading only project `.gitignore` under `Root(start)`, always skipping `.git`
  - `func Ignored(root, absPath string, isDir bool) bool` — true if path should be skipped for discovery

- [ ] **Step 1: Add dependency**

```bash
cd /Users/barry/git/markview
go get github.com/git-pkgs/gitignore@v1.3.0
```

- [ ] **Step 2: Write failing tests** in `internal/ignore/ignore_test.go`

```go
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
	os.WriteFile(filepath.Join(dir, ".gitignore"), []byte("node_modules/\nsecret.md\n"), 0o600)
	os.WriteFile(filepath.Join(dir, "keep.md"), []byte("# keep"), 0o600)
	os.WriteFile(filepath.Join(dir, "secret.md"), []byte("# secret"), 0o600)
	os.MkdirAll(filepath.Join(dir, "node_modules", "pkg"), 0o700)
	os.WriteFile(filepath.Join(dir, "node_modules", "pkg", "x.md"), []byte("# x"), 0o600)
	os.MkdirAll(filepath.Join(dir, ".git", "objects"), 0o700)
	os.WriteFile(filepath.Join(dir, ".git", "objects", "y.md"), []byte("# y"), 0o600)

	var files []string
	err := ignore.Walk(dir, func(abs string, d fs.DirEntry) error {
		if !d.IsDir() {
			rel, _ := filepath.Rel(dir, abs)
			files = append(files, filepath.ToSlash(rel))
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || files[0] != "keep.md" {
		t.Fatalf("got %v, want [keep.md]", files)
	}
}

func TestIgnored_NestedGitignore(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, "docs"), 0o700)
	os.WriteFile(filepath.Join(dir, "docs", ".gitignore"), []byte("draft.md\n"), 0o600)
	os.WriteFile(filepath.Join(dir, "docs", "ok.md"), []byte("# ok"), 0o600)
	os.WriteFile(filepath.Join(dir, "docs", "draft.md"), []byte("# draft"), 0o600)

	root := ignore.Root(dir)
	if ignore.Ignored(root, filepath.Join(dir, "docs", "draft.md"), false) != true {
		t.Fatal("draft.md should be ignored")
	}
	if ignore.Ignored(root, filepath.Join(dir, "docs", "ok.md"), false) != false {
		t.Fatal("ok.md should not be ignored")
	}
}

func TestRoot_FindsGitDir(t *testing.T) {
	dir := t.TempDir()
	os.MkdirAll(filepath.Join(dir, ".git"), 0o700)
	os.MkdirAll(filepath.Join(dir, "sub", "deep"), 0o700)
	got := ignore.Root(filepath.Join(dir, "sub", "deep"))
	if got != dir {
		t.Fatalf("Root=%q, want %q", got, dir)
	}
}
```

- [ ] **Step 3: Run tests — expect fail**

```bash
go test ./internal/ignore/ -count=1
```

Expected: fail (package missing)

- [ ] **Step 4: Implement `internal/ignore/ignore.go`**

```go
package ignore

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/git-pkgs/gitignore"
)

func Root(start string) string {
	cur := filepath.Clean(start)
	for {
		if fi, err := os.Stat(filepath.Join(cur, ".git")); err == nil && fi.IsDir() {
			return cur
		}
		parent := filepath.Dir(cur)
		if parent == cur {
			return filepath.Clean(start)
		}
		cur = parent
	}
}

func Ignored(root, absPath string, isDir bool) bool {
	root = filepath.Clean(root)
	absPath = filepath.Clean(absPath)
	rel, err := filepath.Rel(root, absPath)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(os.PathSeparator)) {
		return false
	}
	relSlash := filepath.ToSlash(rel)
	if relSlash == ".git" || strings.HasPrefix(relSlash, ".git/") {
		return true
	}
	m := gitignore.New("")
	loadAncestorGitignores(m, root, absPath)
	return m.MatchPath(relSlash, isDir)
}

func Walk(start string, fn func(absPath string, d fs.DirEntry) error) error {
	start = filepath.Clean(start)
	root := Root(start)
	m := gitignore.New("")
	if err := loadGitignoresBetween(m, root, start); err != nil {
		return err
	}
	return walk(root, start, m, fn)
}

// loadAncestorGitignores loads root .gitignore and each directory's .gitignore
// from root down to the parent of absPath (inclusive of directories on the path).
func loadAncestorGitignores(m *gitignore.Matcher, root, absPath string) { /* ... */ }

// loadGitignoresBetween loads .gitignore from root through start (inclusive).
func loadGitignoresBetween(m *gitignore.Matcher, root, start string) error { /* ... */ }

// walk mirrors git-pkgs pruned walk: skip .git, skip ignored dirs, AddFromFile on enter.
func walk(root, dir string, m *gitignore.Matcher, fn func(string, fs.DirEntry) error) error { /* ... */ }
```

Implementation notes:

- Paths passed to `MatchPath` must be forward-slash relative to `root`.
- `AddFromFile(abs, relDir)` — `relDir` is relative to root with forward slashes ("" for root).
- When entering directory `rel`, call `m.AddFromFile(filepath.Join(abs, ".gitignore"), rel)` before reading children (missing file is fine — library no-ops).
- On ignored directory, do not call `fn` for children; return `fs.SkipDir` from WalkDir or skip recursion.

- [ ] **Step 5: Run tests — expect pass**

```bash
go test ./internal/ignore/ -count=1
```

- [ ] **Step 6: Commit**

```bash
git add go.mod go.sum internal/ignore/
git commit -m "feat: add internal/ignore wrapper over git-pkgs/gitignore"
```

---

### Task 2: Wire ignore into `AddPattern` + watch paths

**Files:**
- Modify: `internal/server/server.go` (`GlobPattern`, `AddPattern`, `walkDirsForPattern`, `handleCreateForGlobs`, `matchAndAddFile`)
- Modify: `internal/server/server_test.go` (new tests)

**Interfaces:**
- Consumes: `ignore.Root`, `ignore.Walk`, `ignore.Ignored`
- Produces: `GlobPattern.IgnoreRoot string` set in `AddPattern`

- [ ] **Step 1: Write failing server tests**

```go
func TestAddPattern_RespectsGitignore(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, ".gitignore"), []byte("node_modules/\n"), 0o600)
	os.WriteFile(filepath.Join(dir, "readme.md"), []byte("# r"), 0o600)
	os.MkdirAll(filepath.Join(dir, "node_modules"), 0o700)
	os.WriteFile(filepath.Join(dir, "node_modules", "x.md"), []byte("# x"), 0o600)

	s := newTestState(t)
	entries, err := s.AddPattern(filepath.Join(dir, "**", "*.md"), DefaultGroup)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("matched=%d, want 1 (gitignore should drop node_modules)", len(entries))
	}
	if entries[0].Name != "readme.md" {
		t.Fatalf("got %s, want readme.md", entries[0].Name)
	}
}

func TestAddFile_IgnoresGitignore(t *testing.T) {
	dir := t.TempDir()
	os.WriteFile(filepath.Join(dir, ".gitignore"), []byte("secret.md\n"), 0o600)
	path := filepath.Join(dir, "secret.md")
	os.WriteFile(path, []byte("# s"), 0o600)

	s := newTestState(t)
	entry := s.AddFile(path, DefaultGroup)
	if entry == nil || entry.Name != "secret.md" {
		t.Fatal("explicit AddFile must still add ignored paths")
	}
}
```

- [ ] **Step 2: Run — expect fail**

```bash
go test ./internal/server/ -run 'TestAddPattern_RespectsGitignore|TestAddFile_IgnoresGitignore' -count=1
```

Expected: `TestAddPattern_RespectsGitignore` fails (matches 2)

- [ ] **Step 3: Integrate**

1. Add `IgnoreRoot string` to `GlobPattern`; set `gp.IgnoreRoot = ignore.Root(base)` when creating the pattern.
2. Replace `doublestar.Glob(...)` in `AddPattern` with:

```go
err = ignore.Walk(base, func(abs string, d fs.DirEntry) error {
	if d.IsDir() {
		return nil
	}
	rel, err := filepath.Rel(base, abs)
	if err != nil {
		return nil
	}
	matched, err := doublestar.Match(relPat, filepath.ToSlash(rel))
	if err != nil || !matched {
		// Also try matching absolute path form used historically:
		ok, err2 := doublestar.Match(dsPattern, filepath.ToSlash(abs))
		if err2 != nil || !ok {
			return nil
		}
	}
	entries = append(entries, s.AddFile(abs, groupName))
	return nil
})
```

Prefer **one** matching strategy consistent with `matchAndAddFile` (absolute `PatternSlash` match is current behavior — keep that):

```go
matched, err := doublestar.Match(gp.PatternSlash, filepath.ToSlash(abs))
```

3. In `walkDirsForPattern`, before `fn(path)` on dirs, skip when `ignore.Ignored(gp.IgnoreRoot, path, true)` (still call `fn` on base if needed for refcount cleanup on remove — for **add** path skip ignored; for **remove** path prefer still walking to clean watches: pass a `respectIgnore bool` or use two helpers). Simplest: only skip ignored dirs when **adding** watches (`watchDirsForPattern`); `RemovePattern` can keep walking all dirs that were previously watched, or walk with ignore too if watches were never added under ignored trees.

4. In `handleCreateForGlobs`, if path is dir/file and `ignore.Ignored(ignore.Root(gp.BaseDir), path, isDir)` for relevant patterns, return early / skip scan.

5. In `matchAndAddFile`, before `AddFile`:

```go
if ignore.Ignored(gp.IgnoreRoot, path, false) {
	continue
}
```

(If `IgnoreRoot` empty for old patterns, compute `ignore.Root(gp.BaseDir)`.)

- [ ] **Step 4: Run server tests**

```bash
go test ./internal/server/ -count=1
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/server/server.go internal/server/server_test.go
git commit -m "feat: apply gitignore pruning to watch and glob discovery"
```

---

### Task 3: Docs touch-up + verify

**Files:**
- Modify: `README.md` (short note under Glob Patterns / watch that `.gitignore` is respected)
- Optional: `.github/copilot-instructions.md` one line if watch behavior is documented there

- [ ] **Step 1: Add README note** near Glob Patterns: watch patterns respect project `.gitignore` (and always skip `.git`); explicit file args do not.

- [ ] **Step 2: Run full Go tests**

```bash
go test ./...
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: note gitignore filtering for watch patterns"
```

---

## Spec coverage

| Spec requirement | Task |
| ---------------- | ---- |
| Filter AddPattern / watch only | Task 2 |
| Explicit AddFile unfiltered | Task 2 test |
| Project `.gitignore` + nested | Task 1 |
| Always skip `.git/` | Task 1 |
| Prune during walk | Task 1 Walk + Task 2 |
| Reuse library | Task 1 (`git-pkgs/gitignore`) |
| No global excludes / no disable flag | Task 1 uses `New("")` |
