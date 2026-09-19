# Slides Rendering Polish (Phase 1) — Design

## Problem

Built-in Slides mode reuses normal Markdown reading styles inside a 16:9 frame. Typography and spacing still feel like a document, not a talk deck. A separate Marp theme exists for export (`docs/slides/theme-markview.css`) but does not apply to the in-app viewer.

## Goal (Phase 1)

Make in-app Slides look like a **presentation**: stronger hierarchy, better whitespace, clearer lists/quotes, and automatic cover centering for short title slides — without changing the Markdown pipeline or reading mode.

## Settled decisions

| Decision | Choice |
| -------- | ------ |
| Overall roadmap | Phased: layout → diagrams/code → fullscreen atmosphere |
| Phase 1 focus | Typography & layout only |
| Visual direction | Presentation style (independent slide CSS; Marp-inspired, not Marp runtime) |
| Cover slides | Auto-detect short title slides and vertically center |
| Implementation | Pure CSS theme layer + small cover heuristic (Approach A) |

## Out of scope (later phases)

- Mermaid / code-block sizing and layout in slides
- Fullscreen background / atmosphere overhaul
- Marp runtime or a forked React component map for slides
- Changing `---` slide splitting rules

## Behavior

### Reading mode

Unchanged.

### Slides mode

1. Apply presentation typography under `.markdown-body--slides .markdown-slide-page` (and related selectors): larger headings, roomier padding, more prominent lists/blockquotes/strong.
2. Hide or neutralize collapsible-heading chevrons (▶/▼) in slides so pages do not look like an outline tool.
3. **Cover detection** on the current slide markdown source (before render). If it qualifies, add `markdown-slide-page--cover` to the slide `<section>`.

### Cover heuristic (`isSlideCover`)

Ignore blank lines. A slide is a cover when **all** hold:

- Exactly one ATX heading at `#` or `##` (no other headings)
- At most two additional paragraph lines (non-heading, non-blank)
- Each of those paragraphs is short (≤ ~80 characters)
- No list markers, tables, fenced code, or blockquotes

Otherwise treat as a normal (top-aligned) content slide.

Heuristic is intentionally simple and source-based (no AST required in Phase 1). Thresholds may be tuned in implementation if fixtures feel wrong.

## Architecture

```
currentSlide markdown
  → isSlideCover(currentSlide)?
  → <section class="markdown-slide-page [--cover]">
      → existing Markdown + components pipeline
```

### Files (expected)

| File | Change |
| ---- | ------ |
| `frontend/src/components/MarkdownViewer.tsx` | Export/add `isSlideCover`; conditional `--cover` class on slide section; optionally skip collapse UI in slides via components flag |
| `frontend/src/styles/app.css` | Presentation theme + cover flex centering |
| `frontend/src/components/MarkdownViewer.slides.test.tsx` (and/or unit tests next to helper) | Cover vs non-cover cases; existing nav tests stay green |

## Visual direction (constraints)

- Stay on the product’s existing light/dark CSS variables (`--color-gh-*`); do not introduce a purple-on-white or cream/terracotta default look.
- Prefer calm presentation hierarchy over decorative chrome.
- Cover: centered title (and optional short subtitle lines); content slides: top-aligned with comfortable margins inside the existing 16:9 page.

## Testing

- Unit: cover true/false fixtures (title-only; title + short line; list page; code fence page)
- Existing slides keyboard/button tests remain passing
- Manual: `docs/slides/tech-talk-template.md` and a short local `---` sample

## Success criteria

- Opening Slides on a typical talk doc feels clearly more “deck-like” than reading mode
- Title-only (or title + one short line) pages center as covers
- Content pages with lists stay top-aligned and readable
- Reading mode pixel-behavior unchanged
- No new heavy dependencies

## Follow-ons (not this PR)

- Phase 2: diagram/code layout in slides
- Phase 3: fullscreen atmosphere closer to Marp theme
