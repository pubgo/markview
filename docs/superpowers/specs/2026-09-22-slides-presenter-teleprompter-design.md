# Slides Presenter Teleprompter (Approach A) — Design

## Problem

Speakers with **two displays** (personal + audience) currently keep speaker notes in the **same** Slides window. When the audience display is shared/fullscreen, notes either clutter the stage or stay hidden and useless. There is no independent teleprompter window that can sit on the personal monitor while the main window shows slides only.

## Goal

In Slides mode, open a **separate teleprompter popup** (`P`) on the personal screen: large notes, page position, and prev/next slide titles — kept in sync with the main deck via `BroadcastChannel`. Audience screen keeps fullscreen slides without the bottom notes panel by default.

## Settled decisions

| Decision | Choice |
| -------- | ------ |
| Approach | **A** — `window.open` popup + `BroadcastChannel` sync |
| Primary scenario | Dual monitor; share/fullscreen the audience display only |
| Notes source | Existing HTML comments (`<!-- ... -->`) via `extractSlideNotes` |
| Truth owner | Main Slides window; teleprompter only sends `goto` |
| Shortcut | `P` open/focus/close teleprompter; `N` still toggles in-window notes |
| In-window notes | Hide by default while teleprompter is open; `N` can re-show |

## Out of scope

- Dedicated `/presenter` SPA route as the primary entry (Approach B)
- Same-window split view as the main solution (Approach C)
- Timer / countdown, laser pointer, phone remote
- In-app PPTX export
- Changing notes syntax or Marp CLI path

## Behavior

### Entry / exit

1. Slides mode only: press **`P`** or click a **提词器** control → `window.open` teleprompter (same origin).
2. If the popup is blocked → show a short in-app hint to allow popups, then retry with `P`.
3. Press **`P`** again while the popup is open → **close** it (simple toggle). Focusing an already-open popup is not required for v1.
4. Closing the popup (window X) clears “teleprompter open” state on the main window.
5. Closing or refreshing the main window → teleprompter shows disconnected / closes.

### Teleprompter UI

- Current slide **notes** in large readable type (plain text from extracted comments).
- Empty notes → `（无备注）`.
- **Page** `i / N`.
- One-line **prev** and **next** slide titles (first heading text of those slides, or truncated body).
- Keyboard: `←/→` (and same page keys as main) send `goto`; optional on-screen prev/next buttons.

### Main window while teleprompter open

- Bottom notes panel **defaults off** (avoid projecting notes).
- `N` still toggles the in-window panel.
- Fullscreen `F`, progress bar, overlay chrome unchanged.
- Slide index changes (click, keys, progress bar) broadcast `state` to the teleprompter.

## Architecture

```
Main (MarkdownViewer Slides)
  ├─ extractSlideNotes / slide index / titles
  ├─ BroadcastChannel("markview-slides-presenter")
  │     state → teleprompter
  │     goto  ← teleprompter
  └─ window.open(?presenter=1&…)  → PresenterTeleprompter view

Teleprompter window
  ├─ subscribe channel, render notes + i/N + neighbors
  └─ keydown → post goto
```

### Channel messages

| Type | Direction | Payload (minimal) |
| ---- | --------- | ----------------- |
| `hello` | either | `{ sessionId }` — request full `state` |
| `state` | main → tele | `{ sessionId, fileId, slideIndex, slideCount, notes, title, prevTitle, nextTitle, deckRevision }` |
| `goto` | tele → main | `{ sessionId, slideIndex }` |

- `sessionId`: random id created when opening the popup; ignore messages from other decks/tabs.
- `deckRevision`: bumps when file content reloads so teleprompter refreshes notes/titles.

### Files (expected)

| File | Change |
| ---- | ------ |
| `frontend/src/utils/slidesPresenterChannel.ts` | Channel name, message types, helpers |
| `frontend/src/components/PresenterTeleprompter.tsx` | Teleprompter UI + key handlers |
| `frontend/src/components/MarkdownViewer.tsx` | `P` shortcut, open/close, broadcast state, handle goto, default-hide notes |
| `frontend/src/styles/app.css` | Teleprompter typography / layout |
| `frontend/src/App.tsx` (or router entry) | Detect `presenter=1` and mount teleprompter shell only |
| Tests | Channel helpers + open/sync/goto behavior (jsdom-friendly mocks) |
| Docs | README shortcuts, `strategy-status.md`, `slides-test-cases.md`, `slides-complete.md` note |

## Testing

- Unit: encode/decode messages; title helpers; sessionId filtering.
- Component: Slides → `P` opens (mocked `window.open`); main index change updates tele via channel mock; tele `goto` changes main index; popup blocked shows hint.
- Manual: two windows on two displays; audience fullscreen without notes; personal teleprompter shows notes and tracks flips.

## Success criteria

- Teleprompter usable on a second monitor without notes on the shared slides window by default
- Bidirectional page sync feels instant for local use
- Existing `N` / notes extraction / deck PDF behavior unchanged when teleprompter is closed
- No new runtime dependencies

## Follow-ons (not this phase)

- Richer transitions picker
- Full-bleed image layouts
- Timer / clock in teleprompter
- Approach B bookmarkable `/presenter` URL as alternate entry
