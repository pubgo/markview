# Slides Presenter Teleprompter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Slides mode opens a second-monitor teleprompter popup (`P`) synced via `BroadcastChannel`, with large notes and page context, while the main window stays audience-safe.

**Architecture:** Main `MarkdownViewer` owns deck state and broadcasts `state`; popup at `?presenter=1&session=…` renders `PresenterTeleprompter` and posts `goto`. Same-origin only; no server.

**Tech Stack:** React, TypeScript, Vitest, `BroadcastChannel`, existing `extractSlideNotes`.

## Global Constraints

- No new runtime dependencies
- Reuse `<!-- -->` notes; do not change notes syntax
- `P` toggles teleprompter; `N` still toggles in-window notes
- While teleprompter open, in-window notes default off
- Dual-monitor / share audience display is the primary scenario

## File map

| File | Responsibility |
| ---- | -------------- |
| `frontend/src/utils/slidesPresenterChannel.ts` | Channel name, message types, open helpers |
| `frontend/src/utils/slidePreviewTitle.ts` | First-heading / truncated title for prev/next |
| `frontend/src/components/PresenterTeleprompter.tsx` | Teleprompter UI |
| `frontend/src/main.tsx` | Branch to teleprompter app when `presenter=1` |
| `frontend/src/components/MarkdownViewer.tsx` | `P`, open/close, broadcast, handle `goto` |
| `frontend/src/styles/app.css` | Teleprompter layout |
| Docs / tests / `testdata/slides-complete.md` | Shortcuts + cases |

---

### Task 1: Channel + title helpers (TDD)

**Files:**
- Create: `frontend/src/utils/slidesPresenterChannel.ts`
- Create: `frontend/src/utils/slidesPresenterChannel.test.ts`
- Create: `frontend/src/utils/slidePreviewTitle.ts`
- Create: `frontend/src/utils/slidePreviewTitle.test.ts`

**Produces:**
- `PRESENTER_CHANNEL = "markview-slides-presenter"`
- Types: `PresenterHello`, `PresenterState`, `PresenterGoto`, `PresenterMessage`
- `isPresenterMessage(data: unknown): data is PresenterMessage`
- `createPresenterSessionId(): string`
- `buildPresenterUrl(sessionId: string): string` → current origin + path + `?presenter=1&session=…`
- `slidePreviewTitle(markdown: string): string`

- [ ] **Step 1:** Failing tests for `slidePreviewTitle` (heading, notes stripped, empty)
- [ ] **Step 2:** Implement `slidePreviewTitle` using `extractSlideNotes`
- [ ] **Step 3:** Failing tests for `isPresenterMessage` / `buildPresenterUrl`
- [ ] **Step 4:** Implement channel helpers
- [ ] **Step 5:** `pnpm exec vitest run src/utils/slidePreviewTitle.test.ts src/utils/slidesPresenterChannel.test.ts`

---

### Task 2: PresenterTeleprompter UI (TDD)

**Files:**
- Create: `frontend/src/components/PresenterTeleprompter.tsx`
- Create: `frontend/src/components/PresenterTeleprompter.test.tsx`
- Modify: `frontend/src/styles/app.css`
- Modify: `frontend/src/main.tsx`

**Produces:**
- `PresenterTeleprompter({ sessionId: string })` — listens on channel, renders notes / `i/N` / prev·next titles; arrow keys post `goto`
- `main.tsx`: if `presenter=1` and `session` present, mount teleprompter only (no full `App`)

- [ ] **Step 1:** Test: after mocked `state` message, notes and page label appear; key Right posts `goto`
- [ ] **Step 2:** Implement component + CSS (large notes, calm dark/light via existing tokens)
- [ ] **Step 3:** Wire `main.tsx` branch
- [ ] **Step 4:** Tests pass

---

### Task 3: MarkdownViewer integration

**Files:**
- Modify: `frontend/src/components/MarkdownViewer.tsx`
- Modify: `frontend/src/components/MarkdownViewer.slides.test.tsx`

**Behavior:**
- State: `presenterSessionId`, `presenterWindowRef`, `presenterPopupBlocked`
- `P`: if open → `presenterWindow.close()` and clear; else open via `buildPresenterUrl`, set session, hide in-window notes, send `state`
- On `slideIndex` / content / slides change: broadcast `state` if session active
- On channel `goto` with matching session: clamp and set `slideIndex`
- On channel `hello`: resend `state`
- `beforeunload` / popup `pagehide`: clear session; poll `presenterWindow.closed`
- Control button「提词器」next to fullscreen when slides overlay visible
- Hint when `window.open` returns null

- [ ] **Step 1:** Test open mocked `window.open`, assert URL has `presenter=1`; index change posts state; goto updates index; `P` closes
- [ ] **Step 2:** Implement wiring
- [ ] **Step 3:** `pnpm exec vitest run src/components/MarkdownViewer.slides.test.tsx src/components/PresenterTeleprompter.test.tsx`

---

### Task 4: Docs + example + install

**Files:**
- Modify: `README.md`, `docs/strategy-status.md`, `docs/slides-test-cases.md`, `docs/markdown-capabilities.md`, `testdata/slides-complete.md`
- Commit design+plan if not yet committed

- [ ] **Step 1:** Document `P` teleprompter; mark strategy item; add TP-* test cases
- [ ] **Step 2:** `make install` and manual dual-window smoke
- [ ] **Step 3:** Commit + PR

---

## Spec coverage check

| Spec item | Task |
| --------- | ---- |
| `P` open/close popup | 3 |
| Large notes, i/N, prev/next titles | 2 |
| BroadcastChannel sync + goto | 1–3 |
| Default hide in-window notes | 3 |
| Popup blocked hint | 3 |
| Out of scope timers/PPTX | — |

## Execution

Inline in this session (user: 开工). TDD per task; commit after teleprompter feature is green.
