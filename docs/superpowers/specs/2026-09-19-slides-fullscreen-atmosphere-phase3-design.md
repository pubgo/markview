# Slides Fullscreen Atmosphere (Phase 3) — Design

## Problem

In-app Slides fullscreen still feels like a **card floating on a dark page**: heavy border radius, strong shadow, and a stage that does not match light theme. Phase 1/2 improved non-fullscreen deck typography and media; fullscreen immersion (closer to Marp export atmosphere) remains weak.

## Goal

When the user presses **F** (or the fullscreen control), the deck should feel like a **presentation stage**: near-bleed slide surface, unified backdrop, calmer chrome, slightly stronger content contrast — without changing reading mode or non-fullscreen slides preview.

## Settled decisions

| Decision | Choice |
| -------- | ------ |
| Approach | **A** — CSS-only fullscreen atmosphere; follow app light/dark |
| Scope | `:fullscreen` / `markdown-slide-shell--fullscreen` only |
| Marp | Inspired by `docs/slides/theme-markview.css`; no Marp runtime |
| Tokens | Keep `--color-gh-*`; no purple-on-white or cream/terracotta look |
| TS/React | Prefer zero component changes; CSS only unless a test needs an existing class assertion |

## Out of scope

- Dual-column / figure-text layout heuristics
- Forced dark-only fullscreen palette (Approach B)
- Sharing Marp theme CSS as a runtime import (Approach C)
- Progress bar, page transitions, new navigation chrome
- Changing `---` slide splitting or reading mode styles

## Behavior

### Reading mode / non-fullscreen slides

Unchanged.

### Fullscreen slides

1. **Stage**: Shell + `::backdrop` use one cohesive stage gradient (dark theme: deep slate/navy; light theme: soft neutral stage — not harsh black).
2. **Surface**: Slide page nearly fills the viewport; reduce “floating card” cues (smaller radius, softer/no shadow, subtler border).
3. **Content**: Slightly stronger hierarchy for cover titles, blockquotes, and tables under fullscreen selectors only.
4. **Chrome**: Keep auto-hiding fullscreen button + help badge; ensure they stay readable but secondary.

## Architecture

```
user → shell.requestFullscreen()
  → .markdown-slide-shell:fullscreen
       + .markdown-slide-shell--fullscreen
  → CSS only (stage / surface / content / chrome)
```

### Files (expected)

| File | Change |
| ---- | ------ |
| `frontend/src/styles/app.css` | Fullscreen stage, surface, content, chrome rules; light/dark branches |
| `frontend/src/components/MarkdownViewer.slides.test.tsx` | Assert fullscreen class on shell after entering fullscreen |
| Manual | `testdata/slides-media.md`, `docs/slides/tech-talk-template.md` |

## Visual constraints

- Stay on product light/dark variables.
- Prefer calm hierarchy over decorative chrome or glow.
- Light-theme fullscreen must remain comfortable (stage ≠ pure black).
- Do not regress Phase 1/2 non-fullscreen slide sizing for images/Mermaid/tables.

## Testing

- Automated: after Slides → 全屏展示, shell has `markdown-slide-shell--fullscreen` (and existing fullscreen API mock still called).
- Manual: cover, list, table, image, Mermaid in light and dark; non-fullscreen preview unchanged.

## Success criteria

- Fullscreen clearly more “stage-like” than current card-in-room look
- Light and dark themes both usable
- Non-fullscreen slides and reading mode unchanged
- No new dependencies

## Follow-ons (not this phase)

- Layout heuristics (two-column / media+text)
- Progress indicator / transitions
- Further media polish (PlantUML, code overflow)
