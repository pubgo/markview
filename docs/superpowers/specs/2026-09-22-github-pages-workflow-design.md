# GitHub Pages Official Workflow (Approach A) — Design

## Problem

`markview build` can produce a static SPA, and docs describe how to host it on GitHub Pages, but the **markview repository itself has no official Actions workflow**. Consumers and the project’s own docs site still require hand-rolled YAML.

## Goal

Ship a **built-in** `.github/workflows/pages.yml` that, on `master` push (and manual dispatch), builds the whole-repo Markdown tree with `markview build . -o site` and deploys via official GitHub Pages actions.

## Settled decisions

| Decision | Choice |
| -------- | ------ |
| Approach | **A** — `upload-pages-artifact` + `deploy-pages` |
| Build input | Repository root (`.`) — all discovered `.md` / `.mdx` (skips `.git` / `node_modules` / `vendor` / output dir) |
| Output dir | `site/` |
| Triggers | `push` to `master` + `workflow_dispatch` |
| Out of scope | Multi-group export, `--base-path`, custom domain CLI |

## Behavior

1. Checkout source.
2. Setup Go (from `go.mod`) and pnpm (from `frontend/package.json`).
3. `go generate ./internal/static/` then `go install .` so `markview` is on `PATH`.
4. `markview build . -o site`.
5. Upload `site` as Pages artifact; deploy job publishes it.
6. Concurrent runs for the same workflow are cancelled (newer wins).

## Repository setup (human, one-time)

GitHub → Settings → Pages → **Build and deployment** → Source = **GitHub Actions**.

## Files

| File | Change |
| ---- | ------ |
| `.github/workflows/pages.yml` | New official workflow |
| `docs/export-and-static.md` | Point to real workflow; drop “示例未启用” framing |
| `docs/strategy-status.md` | Mark Pages workflow as landed |
| `README.md` | Mention official Pages workflow |

## Success criteria

- Pushing to `master` (or manual run) produces a green Pages deploy when Pages source is Actions
- Build uses repo root; no new CLI flags
- Docs match the shipped workflow

## Follow-ons

- `--base-path` for project-site subpaths if relative assets ever fail
- Multi-group static export
