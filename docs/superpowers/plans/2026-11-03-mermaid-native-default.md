# Mermaid Native Default + Token Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default Mermaid rendering to native Mermaid with openidea-style CSS-token `themeVariables`, and keep `beautiful-mermaid` as an optional settings switch.

**Architecture:** Extend `MermaidSettings` with `renderer: "native" | "beautiful"` (default `"native"`). Extract `resolveNativeMermaidThemeVariables` so native `mermaid.initialize({ theme: "base", themeVariables })` maps markview `--color-gh-*` tokens (or named palettes). `MermaidBlock` only calls beautiful-mermaid when the user opted in and the diagram is supported; otherwise native. Settings UI exposes the engine toggle and greys out beautiful-only spacing sliders.

**Tech Stack:** React 19, mermaid ^11, beautiful-mermaid ^1.1.3, Vitest + Testing Library, existing `markview-mermaid-settings` localStorage.

**Spec:** `docs/superpowers/specs/2026-11-03-mermaid-native-default-design.md`

## Global Constraints

- No new npm dependencies.
- Default `renderer` is `"native"`; missing localStorage field merges to `"native"`.
- Default `theme` becomes `"auto"` (was `"custom"`).
- Native path uses `theme: "base"` + token/`palette` `themeVariables` (not stock `dark`/`default`).
- Presets must not overwrite `renderer`.
- Out of scope: openidea cache/pan-zoom port, PlantUML/SvgBob, slides fit logic unless regression.

## File map

| File | Responsibility |
| ---- | -------------- |
| `frontend/src/hooks/useMermaidSettings.ts` | Add `renderer`; defaults; presets omit `renderer` |
| `frontend/src/hooks/useMermaidSettings.test.ts` | Settings defaults / merge / reset tests |
| `frontend/src/utils/mermaidTheme.ts` | Resolve native `themeVariables` from CSS tokens or named palettes |
| `frontend/src/utils/mermaidTheme.test.ts` | Unit tests for token + palette mapping |
| `frontend/src/components/MarkdownViewer.tsx` | Wire renderer branch + native initialize |
| `frontend/src/components/MermaidBlock.test.tsx` | Update defaults; cover native vs beautiful |
| `frontend/src/components/SettingsModal.tsx` | Engine select + disable beautiful-only sliders |

---

### Task 1: Settings — `renderer` field and defaults

**Files:**
- Modify: `frontend/src/hooks/useMermaidSettings.ts`
- Create: `frontend/src/hooks/useMermaidSettings.test.ts`

**Interfaces:**
- Produces: `MermaidSettings.renderer: "native" | "beautiful"`; `MERMAID_SETTINGS_DEFAULTS.renderer === "native"`; `MERMAID_SETTINGS_DEFAULTS.theme === "auto"`; `MermaidPreset.settings: Omit<MermaidSettings, "preset" | "renderer">`

- [ ] **Step 1: Write the failing settings tests**

Create `frontend/src/hooks/useMermaidSettings.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  MERMAID_PRESETS,
  MERMAID_SETTINGS_DEFAULTS,
  getMermaidSettings,
  invalidateMermaidSettingsCache,
} from "./useMermaidSettings";

describe("useMermaidSettings defaults", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateMermaidSettingsCache();
  });

  it("defaults renderer to native and theme to auto", () => {
    expect(MERMAID_SETTINGS_DEFAULTS.renderer).toBe("native");
    expect(MERMAID_SETTINGS_DEFAULTS.theme).toBe("auto");
    expect(getMermaidSettings().renderer).toBe("native");
    expect(getMermaidSettings().theme).toBe("auto");
  });

  it("fills missing renderer as native when merging stored settings", () => {
    localStorage.setItem(
      "markview-mermaid-settings",
      JSON.stringify({ theme: "nord", nodeSpacing: 40 }),
    );
    invalidateMermaidSettingsCache();
    const settings = getMermaidSettings();
    expect(settings.renderer).toBe("native");
    expect(settings.theme).toBe("nord");
    expect(settings.nodeSpacing).toBe(40);
  });

  it("preserves an explicit beautiful renderer from storage", () => {
    localStorage.setItem(
      "markview-mermaid-settings",
      JSON.stringify({ renderer: "beautiful", theme: "custom" }),
    );
    invalidateMermaidSettingsCache();
    expect(getMermaidSettings().renderer).toBe("beautiful");
  });

  it("preset settings omit renderer so applying a preset cannot wipe it", () => {
    for (const preset of MERMAID_PRESETS) {
      expect("renderer" in preset.settings).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && npm test -- --run src/hooks/useMermaidSettings.test.ts`

Expected: FAIL (no `renderer` on defaults / type errors).

- [ ] **Step 3: Implement settings changes**

In `frontend/src/hooks/useMermaidSettings.ts`:

1. Add to interface:

```ts
export interface MermaidSettings {
  renderer: "native" | "beautiful";
  nodeSpacing: number;
  layerSpacing: number;
  thoroughness: number;
  padding: number;
  theme:
    | "custom"
    | "github-light"
    | "github-dark"
    | "auto"
    | "high-contrast"
    | "tokyo-night"
    | "nord";
  preset: string;
}
```

2. Update defaults:

```ts
export const MERMAID_SETTINGS_DEFAULTS: MermaidSettings = {
  renderer: "native",
  nodeSpacing: 32,
  layerSpacing: 56,
  thoroughness: 5,
  padding: 40,
  theme: "auto",
  preset: "balanced",
};
```

3. Change preset type and leave preset `settings` objects without `renderer`:

```ts
export interface MermaidPreset {
  key: string;
  label: string;
  description: string;
  settings: Omit<MermaidSettings, "preset" | "renderer">;
}
```

`readFromStorage` already spreads `MERMAID_SETTINGS_DEFAULTS` then parsed — missing `renderer` becomes `"native"` automatically. No extra merge logic required.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && npm test -- --run src/hooks/useMermaidSettings.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useMermaidSettings.ts frontend/src/hooks/useMermaidSettings.test.ts
git commit -m "$(cat <<'EOF'
feat: add mermaid renderer setting defaulting to native

Make native Mermaid the default engine and keep beautiful-mermaid
opt-in via persisted settings, without presets overwriting renderer.
EOF
)"
```

---

### Task 2: Native themeVariables helper

**Files:**
- Create: `frontend/src/utils/mermaidTheme.ts`
- Create: `frontend/src/utils/mermaidTheme.test.ts`
- Modify: `frontend/src/components/MarkdownViewer.tsx` (export or move `BEAUTIFUL_MERMAID_PALETTES` / `resolveBeautifulMermaidPalette` for shared use — prefer moving palettes into `mermaidTheme.ts`)

**Interfaces:**
- Consumes: `MermaidSettings` from `useMermaidSettings`; document CSS `--color-gh-*`
- Produces:
  - `resolveCssColor(name: string, el?: Element): string | undefined`
  - `resolveNativeMermaidThemeVariables(settings: MermaidSettings): Record<string, string | boolean>`
  - `resolveBeautifulMermaidPalette(settings: MermaidSettings): Record<string, string>` (moved from MarkdownViewer)
  - `BEAUTIFUL_MERMAID_PALETTES` (moved)

- [ ] **Step 1: Write failing theme tests**

Create `frontend/src/utils/mermaidTheme.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MERMAID_SETTINGS_DEFAULTS } from "../hooks/useMermaidSettings";
import { resolveNativeMermaidThemeVariables } from "./mermaidTheme";

describe("resolveNativeMermaidThemeVariables", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      () =>
        ({
          getPropertyValue: (name: string) => {
            const map: Record<string, string> = {
              "--color-gh-bg": "#0d1117",
              "--color-gh-bg-secondary": "#161b22",
              "--color-gh-bg-hover": "#21262d",
              "--color-gh-text": "#e6edf3",
              "--color-gh-text-secondary": "#8b949e",
              "--color-gh-border": "#30363d",
            };
            return map[name] ?? "";
          },
        }) as unknown as CSSStyleDeclaration,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute("data-theme");
  });

  it("maps auto theme from CSS tokens with darkMode true", () => {
    const vars = resolveNativeMermaidThemeVariables({
      ...MERMAID_SETTINGS_DEFAULTS,
      theme: "auto",
    });
    expect(vars.darkMode).toBe(true);
    expect(vars.background).toBe("#0d1117");
    expect(vars.mainBkg).toBe("#161b22");
    expect(vars.primaryBorderColor).toBe("#30363d");
    expect(vars.primaryTextColor).toBe("#e6edf3");
    expect(vars.lineColor).toBe("#8b949e");
    expect(vars.edgeLabelBackground).toBe("#0d1117");
    expect(vars.fontFamily).toBe("system-ui");
  });

  it("maps named github-dark palette into the same mermaid keys", () => {
    const vars = resolveNativeMermaidThemeVariables({
      ...MERMAID_SETTINGS_DEFAULTS,
      theme: "github-dark",
    });
    expect(vars.darkMode).toBe(true);
    expect(vars.background).toBe("#0d1117");
    expect(vars.primaryTextColor).toBe("#e6edf3");
    expect(vars.lineColor).toBe("#8b949e");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd frontend && npm test -- --run src/utils/mermaidTheme.test.ts`

Expected: FAIL (module missing).

- [ ] **Step 3: Implement `mermaidTheme.ts`**

Create `frontend/src/utils/mermaidTheme.ts`:

1. Move `BEAUTIFUL_MERMAID_PALETTES`, `getMermaidTheme` (or inline dark check), and `resolveBeautifulMermaidPalette` from `MarkdownViewer.tsx` into this module (keep behaviour identical).
2. Add:

```ts
import { type MermaidSettings, getMermaidSettings } from "../hooks/useMermaidSettings";

export function resolveCssColor(varName: string, el: Element = document.documentElement): string | undefined {
  const raw = getComputedStyle(el).getPropertyValue(varName).trim();
  if (!raw) return undefined;
  if (/^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(raw)) return raw;
  return undefined;
}

export function resolveNativeMermaidThemeVariables(
  settings: MermaidSettings = getMermaidSettings(),
): Record<string, string | boolean> {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const out: Record<string, string | boolean> = {
    darkMode: isDark,
    fontFamily: "system-ui",
  };

  if (settings.theme === "auto") {
    const bg = resolveCssColor("--color-gh-bg");
    const surface = resolveCssColor("--color-gh-bg-secondary");
    const hover = resolveCssColor("--color-gh-bg-hover");
    const fg = resolveCssColor("--color-gh-text");
    const muted = resolveCssColor("--color-gh-text-secondary");
    const border = resolveCssColor("--color-gh-border");
    if (bg) {
      out.background = bg;
      out.edgeLabelBackground = bg;
    }
    if (surface) {
      out.mainBkg = surface;
      out.primaryColor = surface;
    }
    if (hover) {
      out.secondaryColor = hover;
      out.tertiaryColor = hover;
      out.clusterBkg = hover;
    } else if (surface) {
      out.secondaryColor = surface;
      out.tertiaryColor = surface;
      out.clusterBkg = surface;
    }
    if (fg) {
      out.primaryTextColor = fg;
      out.textColor = fg;
      out.titleColor = fg;
    }
    if (muted) {
      out.lineColor = muted;
      out.tertiaryTextColor = muted;
    }
    if (border) {
      out.primaryBorderColor = border;
      out.clusterBorder = border;
    }
    return out;
  }

  const palette = resolveBeautifulMermaidPalette(settings);
  out.background = palette.bg;
  out.edgeLabelBackground = palette.bg;
  out.mainBkg = palette.surface;
  out.primaryColor = palette.surface;
  out.secondaryColor = palette.surface;
  out.tertiaryColor = palette.surface;
  out.clusterBkg = palette.surface;
  out.primaryTextColor = palette.fg;
  out.textColor = palette.fg;
  out.titleColor = palette.fg;
  out.lineColor = palette.line;
  out.tertiaryTextColor = palette.muted;
  out.primaryBorderColor = palette.border;
  out.clusterBorder = palette.border;
  return out;
}
```

3. Update `MarkdownViewer.tsx` imports to use palette helpers from `../utils/mermaidTheme` and delete the inlined copies.

- [ ] **Step 4: Run theme + MermaidBlock tests**

Run:

```bash
cd frontend && npm test -- --run src/utils/mermaidTheme.test.ts src/components/MermaidBlock.test.tsx
```

Expected: `mermaidTheme` PASS; MermaidBlock may still pass if palette move is behaviour-identical (beautiful still default in those tests until Task 3).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/mermaidTheme.ts frontend/src/utils/mermaidTheme.test.ts frontend/src/components/MarkdownViewer.tsx
git commit -m "$(cat <<'EOF'
feat: map mermaid base themeVariables from app CSS tokens

Extract shared palette helpers and add openidea-style native
themeVariables resolution for auto and named themes.
EOF
)"
```

---

### Task 3: MermaidBlock — honor renderer + native initialize

**Files:**
- Modify: `frontend/src/components/MarkdownViewer.tsx` (`MermaidBlock` render effect / initialize)
- Modify: `frontend/src/components/MermaidBlock.test.tsx`

**Interfaces:**
- Consumes: `getMermaidSettings().renderer`; `resolveNativeMermaidThemeVariables`; `supportsBeautifulMermaid`; `renderBeautifulMermaid`
- Produces: default path never calls beautiful unless `renderer === "beautiful"`

- [ ] **Step 1: Update / add failing MermaidBlock tests**

In `MermaidBlock.test.tsx` `beforeEach`, clear settings so defaults apply:

```ts
import {
  invalidateMermaidSettingsCache,
} from "../hooks/useMermaidSettings";

beforeEach(() => {
  localStorage.clear();
  invalidateMermaidSettingsCache();
  // ...existing clipboard / mock clears
});
```

Add helper:

```ts
function setMermaidRenderer(renderer: "native" | "beautiful") {
  localStorage.setItem(
    "markview-mermaid-settings",
    JSON.stringify({ renderer }),
  );
  invalidateMermaidSettingsCache();
}
```

Change expectations:

1. New test — default uses native:

```ts
it("defaults to native mermaid with base themeVariables", async () => {
  vi.mocked(mermaid.render).mockResolvedValue({
    svg: '<svg width="360" height="180">native</svg>',
    bindFunctions: undefined,
    diagramType: "flowchart",
  });

  render(<MermaidBlock code="graph TD; A-->B" />);

  await waitFor(() => {
    expect(vi.mocked(mermaid.render)).toHaveBeenCalled();
  });
  expect(renderMermaidSVGMock).not.toHaveBeenCalled();
  expect(vi.mocked(mermaid.initialize)).toHaveBeenCalledWith(
    expect.objectContaining({
      theme: "base",
      securityLevel: "strict",
      suppressErrorRendering: true,
      themeVariables: expect.objectContaining({
        fontFamily: "system-ui",
      }),
      flowchart: expect.objectContaining({
        htmlLabels: true,
        useMaxWidth: false,
        nodeSpacing: 50,
        rankSpacing: 50,
        padding: 15,
        curve: "basis",
      }),
    }),
  );
});
```

2. Existing beautiful-preferring tests (`uses beautiful-mermaid…`, `still uses beautiful…`, `passes a single system font…`, `falls back when beautiful fails`) must call `setMermaidRenderer("beautiful")` first.

3. Keep the unsupported-sequence native test as-is (works for both engines).

- [ ] **Step 2: Run tests — expect FAIL on default-native assertion**

Run: `cd frontend && npm test -- --run src/components/MermaidBlock.test.tsx`

Expected: FAIL — still calling beautiful by default / initialize still uses `theme: "dark"|"default"`.

- [ ] **Step 3: Implement MermaidBlock path**

In `MarkdownViewer.tsx`, add a small helper used by both initialize call sites:

```ts
async function initializeNativeMermaid(): Promise<void> {
  const mermaid = await loadMermaid();
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    suppressErrorRendering: true,
    theme: "base",
    themeVariables: resolveNativeMermaidThemeVariables(getMermaidSettings()),
    flowchart: {
      htmlLabels: true,
      useMaxWidth: false,
      nodeSpacing: 50,
      rankSpacing: 50,
      padding: 15,
      curve: "basis",
    },
    sequence: {
      useMaxWidth: false,
    },
  });
}
```

Replace the `doRender` branch roughly with:

```ts
const settings = getMermaidSettings();
const canUseBeautiful =
  settings.renderer === "beautiful" && supportsBeautifulMermaid(normalizedCode);

if (canUseBeautiful) {
  try {
    const renderBeautiful = await loadBeautifulMermaidRender();
    if (!renderBeautiful) throw new Error("beautiful-mermaid unavailable");
    renderedSvg = renderBeautifulMermaid(normalizedCode, renderBeautiful);
  } catch {
    await initializeNativeMermaid();
    renderedSvg = await renderMermaid(normalizedCode, width);
  }
} else {
  await initializeNativeMermaid();
  renderedSvg = await renderMermaid(normalizedCode, width);
}
```

Remove the old `theme: getMermaidTheme()` initialize blocks.

- [ ] **Step 4: Run MermaidBlock tests — expect PASS**

Run: `cd frontend && npm test -- --run src/components/MermaidBlock.test.tsx`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MarkdownViewer.tsx frontend/src/components/MermaidBlock.test.tsx
git commit -m "$(cat <<'EOF'
feat: render mermaid with native engine by default

Honor the renderer setting, initialize native mermaid with base
themeVariables, and keep beautiful-mermaid as an explicit opt-in.
EOF
)"
```

---

### Task 4: SettingsModal — engine toggle and slider gating

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx`
- Create or extend: prefer a focused test if one exists; otherwise add `frontend/src/components/SettingsModal.test.tsx`

**Interfaces:**
- Consumes: `settings.renderer`; `handleUpdate({ renderer })`
- Produces: select labeled for 渲染引擎; spacing sliders `disabled` when `renderer === "native"`

- [ ] **Step 1: Write failing UI test**

Create `frontend/src/components/SettingsModal.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsModal } from "./SettingsModal";
import { invalidateMermaidSettingsCache } from "../hooks/useMermaidSettings";

describe("SettingsModal mermaid renderer", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateMermaidSettingsCache();
  });

  it("shows native engine by default and disables beautiful-only sliders", () => {
    render(<SettingsModal isOpen onClose={() => {}} />);
    const engine = screen.getByLabelText("渲染引擎") as HTMLSelectElement;
    expect(engine.value).toBe("native");
    expect(screen.getByLabelText("节点间距")).toBeDisabled();
    expect(screen.getByLabelText("层间距")).toBeDisabled();
    expect(screen.getByLabelText("画布边距")).toBeDisabled();
    expect(screen.getByLabelText("交叉优化")).toBeDisabled();
    expect(screen.getByText(/仅 beautiful-mermaid/i)).toBeInTheDocument();
  });

  it("enables spacing sliders when switching to beautiful-mermaid", async () => {
    const user = userEvent.setup();
    render(<SettingsModal isOpen onClose={() => {}} />);
    await user.selectOptions(screen.getByLabelText("渲染引擎"), "beautiful");
    expect(screen.getByLabelText("节点间距")).not.toBeDisabled();
  });
});
```

Note: `SliderRow` currently wraps `<label>` without `htmlFor` / accessible name wiring beyond the span text — update `SliderRow` so the range input is associated (e.g. wrap as now is fine if the text is inside `<label>`; Testing Library `getByLabelText("节点间距")` works when the text node is in the label). For the engine select, wrap with `<label>` containing visible text `渲染引擎` like the existing 配色方案 row.

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd frontend && npm test -- --run src/components/SettingsModal.test.tsx`

Expected: FAIL (no 渲染引擎 control).

- [ ] **Step 3: Implement Settings UI**

In `SettingsModal.tsx`:

1. Add after presets / before 配色方案:

```tsx
<label className="flex items-center gap-3">
  <span className="w-28 shrink-0 text-sm text-gh-text-secondary">渲染引擎</span>
  <select
    className="flex-1 bg-gh-bg border border-gh-border rounded-md px-2 py-1 text-sm text-gh-text focus:border-gh-accent outline-none"
    value={settings.renderer}
    onChange={(e) =>
      handleUpdate({
        renderer: e.target.value as MermaidSettings["renderer"],
        preset: "custom-manual",
      })
    }
  >
    <option value="native">原生 Mermaid（默认）</option>
    <option value="beautiful">beautiful-mermaid</option>
  </select>
</label>
```

2. Extend `SliderRow` with optional `disabled?: boolean`. When disabled, set `disabled` on the `<input type="range">` and reduce opacity on the row.

3. Above the four layout sliders:

```tsx
{settings.renderer === "native" && (
  <p className="text-xs text-gh-text-secondary">
    节点间距等布局参数仅 beautiful-mermaid 生效；原生引擎使用固定 flowchart 间距。
  </p>
)}
```

4. Pass `disabled={settings.renderer === "native"}` to the four `SliderRow`s.

Do **not** put `renderer` into `MERMAID_PRESETS` apply payloads (already omitted by type). Existing `handleUpdate({ ...preset.settings, preset })` keeps current renderer.

- [ ] **Step 4: Run SettingsModal + Mermaid settings tests — expect PASS**

Run:

```bash
cd frontend && npm test -- --run src/components/SettingsModal.test.tsx src/hooks/useMermaidSettings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SettingsModal.tsx frontend/src/components/SettingsModal.test.tsx
git commit -m "$(cat <<'EOF'
feat: add mermaid renderer toggle in settings

Expose native vs beautiful-mermaid and disable beautiful-only
spacing controls while native is selected.
EOF
)"
```

---

### Task 5: Regression sweep + manual visual check

**Files:**
- Verify only (no required code unless failures)

**Interfaces:**
- Consumes: Tasks 1–4 deliverables

- [ ] **Step 1: Run focused + related suites**

```bash
cd frontend && npm test -- --run \
  src/hooks/useMermaidSettings.test.ts \
  src/utils/mermaidTheme.test.ts \
  src/components/MermaidBlock.test.tsx \
  src/components/SettingsModal.test.tsx \
  src/components/MarkdownViewer.slides.test.tsx \
  src/utils/pdfExport.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Manual visual QA**

1. Rebuild/restart markview if needed (`make install` then serve the objectanalytics doc or `testdata/mermaid-flowchart.md`).
2. Dark theme: open the nested Axis flowchart — layout should be native hierarchical (closer to openidea); colours should use `--color-gh-*` surfaces/borders/text.
3. Settings → 渲染引擎 → beautiful-mermaid → Apply → diagram restyles with ELK; spacing sliders enabled.
4. Switch back to native → Apply → native layout returns; sliders disabled.
5. Spot-check a sequence diagram and an erroring mermaid block still show copy / error UI.

- [ ] **Step 3: Fix any regressions found, then commit if code changed**

If no code changes, skip commit.

- [ ] **Step 4: Done checklist against spec**

- [ ] Default renderer native  
- [ ] beautiful optional via settings  
- [ ] `theme: "base"` + token themeVariables for `auto`  
- [ ] Named palettes map to both engines  
- [ ] Presets do not wipe renderer  
- [ ] Sliders gated for native  
- [ ] No new dependencies  

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| ---------------- | ---- |
| Default `renderer: "native"` | Task 1 |
| Default `theme: "auto"` | Task 1 |
| Presets omit renderer | Task 1 + 4 |
| openidea-style `theme: "base"` + CSS tokens | Task 2 + 3 |
| Named palette → native themeVariables | Task 2 |
| beautiful opt-in + fallback | Task 3 |
| Settings engine toggle + grey sliders | Task 4 |
| Tests + manual objectanalytics diagram | Task 3, 5 |
| Out of scope items not planned | ✓ |

No TBD/placeholder steps remain; flowchart spacing numbers match the spec (`50/50/15`, `curve: "basis"`).
