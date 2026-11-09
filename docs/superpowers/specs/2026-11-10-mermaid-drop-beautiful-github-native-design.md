# Drop beautiful-mermaid + GitHub-style Native Mermaid — Design

## Problem

1. `beautiful-mermaid` (ELK packaging) underperforms on real docs: nested subgraphs, odd spacing, and settings that do not improve layout. Users prefer removing it.
2. Native Mermaid in markview still uses a classic `theme: "base"` + hand-tuned flowchart spacing without Mermaid 12’s `neo` look / ELK layout, so it looks flatter and less like GitHub’s Markdown Mermaid preview.

## Goal

1. **Remove** `beautiful-mermaid` entirely (dependency, renderer path, settings option, tests).
2. **Tune native Mermaid** toward GitHub’s preview: Mermaid 12 `look: "neo"` + `layout: "elk"`, plus GitHub light/dark colour variables.
3. Keep **Pele** as the optional alternate engine (current product default remains Pele unless a later change says otherwise).

## Settled decisions

| Decision | Choice |
| -------- | ------ |
| Overall approach | Remove beautiful; native aligned to GitHub look + colours (Approach 1) |
| Engines after change | `"pele"` \| `"native"` only |
| Default `renderer` | `"pele"` (unchanged from current default) |
| Stored `beautiful` | Migrate to `"pele"` on read |
| Native look / layout | `look: "neo"`, `layout: "elk"` via `mermaid.initialize` |
| Native theme | `theme: "base"` + GitHub-oriented `themeVariables` |
| `auto` / `github-*` colours | GitHub light (`#ffffff` / `#f6f8fa` / `#0969da` …) and dark (`#0d1117` / `#161b22` / `#4493f8` …); may still overlay live CSS tokens for text/border when present |
| Other named palettes | nord / tokyo-night / high-contrast / custom keep working for both native and Pele |
| Layout sliders | Remove beautiful-only sliders and copy from Settings UI (they only affected beautiful) |
| Palette helper rename | `resolveBeautifulMermaidPalette` → neutral name (e.g. `resolveMermaidPalette`); constant map similarly |

## Out of scope

- Changing Pele’s internal layout or making Pele default again
- PlantUML / SvgBob
- Porting GitHub Viewscreen iframe isolation
- Editing historical design/plan docs for the old native-default / beautiful-optional work (leave as history)
- New npm dependencies (only removals)

## Behaviour

### Settings (`MermaidSettings`)

```ts
renderer: "pele" | "native"; // default "pele"
```

Persisted in `markview-mermaid-settings`.

Merge / migrate on read:

- missing `renderer` → `"pele"`
- `renderer === "beautiful"` → `"pele"`
- `"native"` / `"pele"` preserved

UI in `SettingsModal`:

- **渲染引擎**: Pele（Obsidian，默认） / 原生 Mermaid
- **配色方案**: unchanged keys
- No beautiful option; remove node/layer/thoroughness sliders (beautiful-only)
- Keep **画布边距** when renderer is Pele (already wired); disable it for native

Presets continue to omit `renderer`.

### Native initialize

```ts
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  suppressErrorRendering: true,
  look: "neo",
  layout: "elk",
  theme: "base",
  themeVariables: resolveNativeMermaidThemeVariables(settings),
  flowchart: {
    htmlLabels: true,
    useMaxWidth: false,
  },
  sequence: {
    useMaxWidth: false,
  },
});
```

Drop classic hand-tuned `nodeSpacing` / `rankSpacing` / `padding` / `curve: "basis"` overrides that fight ELK/`neo` defaults unless a regression requires a minimal override.

### Render path

```
settings.renderer === "pele"
  → Pele
  → on throw / unavailable → native
else
  → native
```

Delete `supportsBeautifulMermaid`, beautiful dynamic import, Google Fonts strip for beautiful SVGs, and beautiful-only sequence directive fallbacks.

### Theme mapping

- Rename palette helpers away from “beautiful”.
- `resolveNativeMermaidThemeVariables`: for `auto` and `github-light` / `github-dark`, prefer GitHub preview colours (with `darkMode` flag); token overlay for fg/border when CSS vars resolve.
- Pele CSS vars continue to consume the shared palette helper.

## File map (expected)

| File | Change |
| ---- | ------ |
| `frontend/package.json` (+ lockfile) | Remove `beautiful-mermaid` |
| `frontend/src/hooks/useMermaidSettings.ts` (+ test) | Narrow renderer union; migrate `beautiful` → `pele` |
| `frontend/src/utils/mermaidTheme.ts` (+ test) | Rename palette helper; GitHub-oriented native vars |
| `frontend/src/components/MarkdownViewer.tsx` | Drop beautiful path; native `look`/`layout` |
| `frontend/src/components/SettingsModal.tsx` (+ test) | Two-engine UI; drop beautiful copy/sliders |
| `frontend/src/components/MermaidBlock.test.tsx` | Remove beautiful cases; assert neo/elk initialize |
| `CHANGELOG.md` | Note removal + native GitHub-style tune (when shipping) |

## Risks

- ELK + `neo` may change layout of existing docs vs classic dagre; intentional for GitHub parity.
- Users who only used beautiful lose that engine; migration lands them on Pele (current default), not silent native.
- Bundle size should drop after removing beautiful-mermaid.

## Success criteria

- No `beautiful-mermaid` import or settings value in the product.
- Fresh / migrated settings never surface `beautiful`.
- Native diagrams initialize with `look: "neo"` and `layout: "elk"`.
- Native `auto` colours read as GitHub-like in light and dark app themes.
- Existing Pele path and its fallback to native still pass tests.
