# Mermaid Native Default + Theme Alignment — Design

## Problem

Markview currently prefers `beautiful-mermaid` (ELK) for supported diagrams. On complex nested flowcharts (e.g. `objectanalytics-design.md` architecture diagram), layout is worse than native Mermaid: crossed edges, odd subgraph ordering, labels harder to read. Dark-mode colours also do not match the cleaner “IDE token → Mermaid base theme” look used by [openidea](https://github.com/l0ng-ai/openidea) (`theme: "base"` + CSS-token `themeVariables`).

## Goal

1. **Default renderer = native Mermaid** for better hierarchical layout on real docs.
2. Keep **beautiful-mermaid optional** via settings toggle.
3. Align **native dark/light colours** with markview CSS tokens (openidea-style), so diagrams read as part of the app theme rather than Mermaid’s stock `dark`/`default`.

## Settled decisions

| Decision | Choice |
| -------- | ------ |
| Overall approach | Renderer switch + native default tuned to tokens (Approach 1) |
| Default `renderer` | `"native"` |
| Optional engine | `"beautiful"` — existing path, still falls back to native on unsupported/fail |
| Theme strategy | Follow app `data-theme` / CSS tokens; do not invent a separate app theme |
| Native Mermaid theme | `theme: "base"` + `themeVariables` from tokens (openidea pattern) |
| Settings palette options | Keep existing theme keys; `auto` maps to live CSS tokens for native; named palettes map shared colour fields into both engines |
| beautiful-only sliders | node/layer spacing, padding, thoroughness — disabled/greyed when renderer is native |
| Reference | openidea `src/features/viewers/markdown/mermaid.ts` |

## Out of scope

- Porting openidea’s diagram result cache or its pan-zoom implementation (markview already has fullscreen zoom/pan)
- PlantUML / SvgBob changes
- Slides-specific fit/scale logic unless a regression appears after the engine switch
- New dependencies

## Behaviour

### Settings (`MermaidSettings`)

Add:

```ts
renderer: "native" | "beautiful"; // default "native"
```

Persisted in existing `markview-mermaid-settings` localStorage. Missing field → `"native"` (**behaviour change**: previous implicit default was beautiful when supported).

Also change `MERMAID_SETTINGS_DEFAULTS.theme` from `"custom"` to `"auto"` so a fresh install uses live CSS tokens on the native path (named palettes remain available). Existing localStorage that already stores `"custom"` is left alone.

UI in `SettingsModal`:

- **渲染引擎**: 原生 Mermaid（默认） / beautiful-mermaid
- Existing **配色方案** remains; applies to both engines
- Layout sliders remain; when `renderer === "native"`, grey out with short note that they apply only to beautiful-mermaid
- Presets do **not** force `renderer`; they continue to set spacing/theme only. Preset `theme` values that today hard-code `"auto"` / `"high-contrast"` stay as-is.
- Apply still goes through `bumpSettingsRevision()` so all `MermaidBlock`s re-render

### `MermaidBlock` render path

```
settings.renderer === "beautiful" && supportsBeautifulMermaid(code)
  → renderBeautifulMermaid
  → on throw / unavailable → native path

else
  → native path (mermaid.initialize + queued mermaid.render)
```

Unsupported beautiful diagrams while renderer is `"beautiful"`: silent native fallback (same as today’s “cannot use beautiful” branch). No new error toast for the engine choice itself.

Fullscreen, fit-width, copy image/code, PDF wait-for-render: unchanged.

### Native initialize (openidea-aligned)

```ts
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  suppressErrorRendering: true,
  theme: "base",
  themeVariables: resolveNativeMermaidThemeVariables(settings),
  flowchart: {
    htmlLabels: true,
    useMaxWidth: false,
    nodeSpacing: 50,
    rankSpacing: 50,
    padding: 15,
    curve: "basis",
  },
  sequence: { useMaxWidth: false },
});
```

Native flowchart spacing is fixed (not wired to beautiful sliders). Tune only if visual QA on the objectanalytics diagram shows crowding.

Errors still surface through existing `MermaidBlock` failed UI (`suppressErrorRendering` only avoids Mermaid’s own error SVG injection).

### `themeVariables` mapping

Resolve computed CSS on `document.documentElement` (hex/rgb only; Mermaid cannot parse `var()` / `color-mix` directly). Prefer reading already-resolved `--color-gh-*` values.

| Mermaid variable | markview token (`auto`) |
| ---------------- | ----------------------- |
| `background`, `edgeLabelBackground` | `--color-gh-bg` |
| `mainBkg`, `primaryColor` | `--color-gh-bg-secondary` |
| `primaryBorderColor`, `clusterBorder` | `--color-gh-border` |
| `primaryTextColor`, `textColor`, `titleColor` | `--color-gh-text` |
| `lineColor`, `tertiaryTextColor` | `--color-gh-text-secondary` |
| `secondaryColor`, `tertiaryColor`, `clusterBkg` | `--color-gh-bg-hover` / secondary |
| `darkMode` | `data-theme === "dark"` |
| `fontFamily` | `system-ui` |

When settings `theme` is a named palette (`github-dark`, `nord`, …), map the existing `BEAUTIFUL_MERMAID_PALETTES` fields (`bg`, `fg`, `line`, `surface`, `border`, …) into the same Mermaid variable names so both engines stay roughly aligned.

Re-render on `data-theme` mutation remains as today.

### beautiful-mermaid path

Unchanged aside from being **opt-in**. Still passes palette + spacing sliders; still strips Google Fonts `@import`.

## Architecture

```
SettingsModal
  → MermaidSettings { renderer, theme, spacing… }
  → bumpSettingsRevision()

MermaidBlock
  → if beautiful + supported → beautiful-mermaid
  → else → native mermaid (theme: base + token themeVariables)
  → normalizeMermaidSvg / layout helpers (unchanged)
```

## Testing

- Default path calls `mermaid.initialize` with `theme: "base"` and token-derived `themeVariables` (mock `getComputedStyle` / `data-theme` as needed)
- `renderer: "beautiful"` still prefers `renderMermaidSVG` when supported
- Unsupported sequence directives / beautiful throw → native fallback
- Existing copy / sanitize / error cases keep passing
- Manual: open `http://localhost:6275/?file=7b023647` (or `testdata/mermaid-flowchart.md`) in dark theme; nested flowchart should match native hierarchical layout and token colours; toggle beautiful and confirm switch + slider enablement

## Success criteria

- Fresh install / cleared settings: complex flowchart layout is native-quality (comparable to openidea reference)
- User can switch to beautiful-mermaid and back without reload
- Dark diagrams use markview bg/fg/border tokens, not stock Mermaid dark purple-blue defaults
- No regression in Mermaid error UI, copy, fullscreen, or PDF pending detection
