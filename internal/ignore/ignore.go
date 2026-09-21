// Package ignore provides project-.gitignore filtering for watch/glob discovery.
// Matching is delegated to github.com/git-pkgs/gitignore; only project .gitignore
// files are loaded (not global excludes or .git/info/exclude). The .git directory
// is always skipped.
package ignore

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/git-pkgs/gitignore"
)

// Root finds the git working tree root by walking up from start for a .git
// entry. If none is found, it returns the nearest ancestor that has a
// .gitignore (or the cleaned start path if neither exists).
func Root(start string) string {
	cur := filepath.Clean(start)
	fallback := ""
	for {
		gitPath := filepath.Join(cur, ".git")
		if fi, err := os.Stat(gitPath); err == nil && (fi.IsDir() || fi.Mode().IsRegular()) {
			return cur
		}
		if fallback == "" {
			if _, err := os.Stat(filepath.Join(cur, ".gitignore")); err == nil {
				fallback = cur
			}
		}
		parent := filepath.Dir(cur)
		if parent == cur {
			if fallback != "" {
				return fallback
			}
			return filepath.Clean(start)
		}
		cur = parent
	}
}

// Ignored reports whether absPath should be skipped during discovery relative
// to the given ignore root (typically Root of a pattern base).
func Ignored(root, absPath string, isDir bool) bool {
	root = filepath.Clean(root)
	absPath = filepath.Clean(absPath)
	rel, err := filepath.Rel(root, absPath)
	if err != nil || !isLocalRel(rel) {
		return false
	}
	relSlash := filepath.ToSlash(rel)
	if relSlash == ".git" || strings.HasPrefix(relSlash, ".git/") {
		return true
	}
	dir := absPath
	if !isDir {
		dir = filepath.Dir(absPath)
	}
	m := matcherThrough(root, dir)
	return m.MatchPath(relSlash, isDir)
}

// Walk walks start and calls fn for each non-ignored file and directory.
// Paths passed to fn are absolute. Nested project .gitignore files are honored;
// .git is never descended into.
func Walk(start string, fn func(absPath string, d fs.DirEntry) error) error {
	start = filepath.Clean(start)
	root := Root(start)
	return walkAbs(root, start, fn)
}

func walkAbs(root, dir string, fn func(absPath string, d fs.DirEntry) error) error {
	m := matcherThrough(root, dir)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		name := entry.Name()
		if name == ".git" && entry.IsDir() {
			continue
		}
		abs := filepath.Join(dir, name)
		rel, err := filepath.Rel(root, abs)
		if err != nil || !isLocalRel(rel) {
			continue
		}
		if m.MatchPath(filepath.ToSlash(rel), entry.IsDir()) {
			continue
		}
		if fn != nil {
			if err := fn(abs, entry); err != nil {
				return err
			}
		}
		if entry.IsDir() {
			if err := walkAbs(root, abs, fn); err != nil {
				return err
			}
		}
	}
	return nil
}

// matcherThrough builds a project-only matcher with .gitignore files from root
// through dir (inclusive).
func matcherThrough(root, dir string) *gitignore.Matcher {
	m := gitignore.New("")
	m.AddFromFile(filepath.Join(root, ".gitignore"), "")

	rel, err := filepath.Rel(root, filepath.Clean(dir))
	if err != nil || !isLocalRel(rel) || rel == "." {
		return m
	}
	slashed := filepath.ToSlash(rel)
	acc := ""
	for _, part := range strings.Split(slashed, "/") {
		if part == "" || part == "." {
			continue
		}
		if acc == "" {
			acc = part
		} else {
			acc += "/" + part
		}
		m.AddFromFile(filepath.Join(root, filepath.FromSlash(acc), ".gitignore"), acc)
	}
	return m
}

func isLocalRel(rel string) bool {
	return rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}
