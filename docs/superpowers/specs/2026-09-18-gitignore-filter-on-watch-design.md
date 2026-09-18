# Gitignore Filter on Watch — Design

## Problem

When adding files via glob / watch patterns (e.g. `markview -w '**/*.md'`), markview expands and watches the entire tree under the pattern base. Directories that projects normally ignore via `.gitignore` (such as `node_modules`, build outputs) are included, which pollutes the file list and wastes watchers.

## Goal

Apply **gitignore-like filtering** to **watch / glob discovery only**, so ignored paths are neither added nor watched — similar in spirit to `git` ignore rules, without requiring the `git` binary.

## Decisions (settled)

| Decision | Choice |
| -------- | ------ |
| Scope | Only glob/watch discovery (`AddPattern`, initial expansion, fsnotify auto-add / dir scan) |
| Explicit adds | Unchanged — CLI file args and `POST /_/api/files` always add |
| Uploads / drag-drop | Unchanged — not filtered |
| Ignore sources | Project `.gitignore` files only (walk upward from pattern base; honor nested rules) |
| Always skip | `.git/` even when no ignore file exists |
| No `.gitignore` | Skip `.git/` only; everything else matches as today |
| Mechanism | Prune during traversal (do not post-filter a full unpruned glob) |
| Implementation | Reuse an existing Go gitignore library; do not hand-roll pattern matching |
| Out of scope | `.git/info/exclude`, global `core.excludesFile`, CLI flag to disable filtering |

## Behavior

### Applies

1. `State.AddPattern` initial expansion
2. Directory watch registration for recursive patterns (`walkDirsForPattern` / `addDirWatch`)
3. Watch loop auto-discovery (`matchAndAddFile`, recursive new-directory scans)

### Does not apply

1. `State.AddFile` when called for an explicitly requested path (CLI / API)
2. `State.AddUploadedFile` and upload API

### Matching semantics

- Load `.gitignore` from the pattern base and ancestors as needed; apply nested `.gitignore` for subtrees.
- Directory patterns prune the walk (do not descend into ignored directories).
- Always treat `.git` as ignored for discovery and watch registration.
- Prefer library behavior that matches common gitignore expectations (negation, last-match-wins) when the chosen library supports them.

## Architecture

```
pattern base
  → ignore matcher (library + project .gitignore)
  → pruned Walk (skip .git/ and ignored dirs)
  → doublestar match against pattern
  → AddFile / addDirWatch
```

### New package: `internal/ignore`

Responsibility:

- Build a matcher rooted at a directory (pattern base or nearest sensible root for nested rules)
- Answer whether a path should be ignored for discovery
- Provide or wrap a pruned directory walk used by the server

The server package must not parse ignore syntax itself.

### Server integration points

| Location | Change |
| -------- | ------ |
| `AddPattern` | Replace unpruned `doublestar.Glob(os.DirFS(base), …)` with pruned walk + per-file glob match |
| `walkDirsForPattern` | Skip ignored directories when registering watches |
| `handlePath` / new-dir walk / `matchAndAddFile` | Ignore check before `AddFile` or descending |

Explicit `AddFile` API remains a direct add with no ignore gate.

## Error handling

- Missing `.gitignore`: treat as empty rules (plus hard-coded `.git/` skip)
- Unreadable ignore file: log a warning and continue with rules already loaded
- Invalid pattern lines: skip/tolerate per library defaults; do not fail the whole pattern registration
- Non-git trees: still apply `.gitignore` files found on disk; no dependency on a `.git` directory existing (except always skipping a `.git` path segment when present)

## Testing

Go tests under `internal/ignore` and/or `internal/server`:

1. Fixture tree with `node_modules/`, `.git/`, root `.gitignore`, and a nested `.gitignore`
2. `AddPattern` with `**/*.md` does **not** include ignored markdown files
3. Explicit `AddFile` of an ignored path **does** add it
4. Ignored directories are not registered for recursive watching (or at least never auto-add children)
5. No `.gitignore` present → only `.git/` is skipped

## Non-goals

- Frontend changes
- Session backup format changes
- Perfect parity with every git edge case beyond what the chosen library provides
- Disable-filter flag

## Success criteria

- `markview -w '**/*.md'` on a typical project with `node_modules` does not list ignored docs
- Explicit `markview path/to/ignored.md` still opens that file
- Watchers are not attached under pruned ignored directories when avoidable
