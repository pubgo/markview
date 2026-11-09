# Drop beautiful-mermaid + GitHub-style Native Mermaid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `beautiful-mermaid`, keep Pele as default / native as optional, and make native Mermaid use GitHub-like `neo`+ELK look plus GitHub light/dark colours.

**Architecture:** Narrow `MermaidSettings.renderer` to `"pele" | "native"` (default `"pele"`; stored `"beautiful"` migrates to `"pele"`). Delete beautiful import/render/settings. Native `mermaid.initialize` sets `look: "neo"`, `layout: "elk"`, `theme: "base"` with GitHub-oriented `themeVariables`. Rename shared palette helper away from “beautiful”.

**Tech Stack:** React 19, mermaid ^12.3, pele ^1.13, Vitest + Testing Library, `markview-mermaid-settings` localStorage.

**Spec:** `docs/superpowers/specs/2026-11-10-mermaid-drop-beautiful-github-native-design.md`

## Global Constraints

- Remove dependency `beautiful-mermaid`; do not add new npm packages.
- `renderer` union is only `"pele" | "native"`; default `"pele"`.
- Stored `"beautiful"` (or missing renderer) → `"pele"` on read.
- Native path: `look: "neo"`, `layout: "elk"`, `theme: "base"` + GitHub-oriented `themeVariables`.
- Presets must not overwrite `renderer`.
- Keep Pele padding slider; remove beautiful-only node/layer/thoroughness sliders.
- Out of scope: Pele layout changes, PlantUML/SvgBob, rewriting historical specs/plans.

## File map

| File | Responsibility |
| ---- | -------------- |
| `frontend/src/hooks/useMermaidSettings.ts` | Narrow renderer; default pele; migrate beautiful |
| `frontend/src/hooks/useMermaidSettings.test.ts` | Defaults / migrate / preserve native |
| `frontend/src/utils/mermaidTheme.ts` | Rename palette helper; GitHub native colours |
| `frontend/src/utils/mermaidTheme.test.ts` | Assert GitHub keys for auto / github-* |
| `frontend/src/components/MarkdownViewer.tsx` | Drop beautiful path; neo/elk initialize |
| `frontend/src/components/MermaidBlock.test.tsx` | Drop beautiful tests; assert initialize |
| `frontend/src/components/SettingsModal.tsx` | Two engines; Pele padding only |
| `frontend/src/components/SettingsModal.test.tsx` | Update UI expectations |
| `frontend/package.json` + lockfile | Remove beautiful-mermaid |

---

### Task 1: Settings — drop beautiful, default pele, migrate

**Files:**
- Modify: `frontend/src/hooks/useMermaidSettings.ts`
- Modify: `frontend/src/hooks/useMermaidSettings.test.ts`

**Interfaces:**
- Produces: `MermaidSettings.renderer: "pele" | "native"`; `MERMAID_SETTINGS_DEFAULTS.renderer === "pele"`; `readFromStorage` maps `"beautiful"` → `"pele"`

- [ ] **Step 1: Write the failing settings tests**

Replace the defaults/migration cases in `useMermaidSettings.test.ts` with:

```ts
it("defaults renderer to pele and theme to auto", () => {
  expect(MERMAID_SETTINGS_DEFAULTS.renderer).toBe("pele");
  expect(MERMAID_SETTINGS_DEFAULTS.theme).toBe("auto");
  expect(getMermaidSettings().renderer).toBe("pele");
  expect(getMermaidSettings().theme).toBe("auto");
});

it("fills missing renderer as pele when merging stored settings", () => {
  localStorage.setItem(
    "markview-mermaid-settings",
    JSON.stringify({ theme: "nord", nodeSpacing: 40 }),
  );
  invalidateMermaidSettingsCache();
  const settings = getMermaidSettings();
  expect(settings.renderer).toBe("pele");
  expect(settings.theme).toBe("nord");
  expect(settings.nodeSpacing).toBe(40);
});

it("migrates stored beautiful renderer to pele", () => {
  localStorage.setItem(
    "markview-mermaid-settings",
    JSON.stringify({ renderer: "beautiful", theme: "custom" }),
  );
  invalidateMermaidSettingsCache();
  expect(getMermaidSettings().renderer).toBe("pele");
});

it("preserves an explicit native renderer from storage", () => {
  localStorage.setItem(
    "markview-mermaid-settings",
    JSON.stringify({ renderer: "native", theme: "auto" }),
  );
  invalidateMermaidSettingsCache();
  expect(getMermaidSettings().renderer).toBe("native");
});

it("preset settings omit renderer so applying a preset cannot wipe it", () => {
  for (const preset of MERMAID_PRESETS) {
    expect("renderer" in preset.settings).toBe(false);
  }
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && pnpm exec vitest run src/hooks/useMermaidSettings.test.ts`

Expected: FAIL on default `pele` and/or beautiful migration.

- [ ] **Step 3: Implement settings**

In `useMermaidSettings.ts`:

1. Change type to `renderer: "pele" | "native"`.
2. Set `MERMAID_SETTINGS_DEFAULTS.renderer` to `"pele"`.
3. After merging parsed storage, normalize:

```ts
function normalizeRenderer(value: unknown): MermaidSettings["renderer"] {
  if (value === "native") return "native";
  return "pele"; // missing, "pele", "beautiful", or anything else
}

// inside readFromStorage success path:
const merged = { ...MERMAID_SETTINGS_DEFAULTS, ...parsed };
merged.renderer = normalizeRenderer(parsed.renderer);
cachedSettings = merged;
```

Keep presets omitting `renderer`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && pnpm exec vitest run src/hooks/useMermaidSettings.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useMermaidSettings.ts frontend/src/hooks/useMermaidSettings.test.ts
git commit -m "$(cat <<'EOF'
feat: drop beautiful renderer setting; default pele

EOF
)"
```

---

### Task 2: Theme — rename palette helper + GitHub native colours

**Files:**
- Modify: `frontend/src/utils/mermaidTheme.ts`
- Modify: `frontend/src/utils/mermaidTheme.test.ts`
- Modify: any imports of `resolveBeautifulMermaidPalette` / `BEAUTIFUL_MERMAID_PALETTES` (MarkdownViewer if any)

**Interfaces:**
- Produces: `resolveMermaidPalette(settings)`; `MERMAID_PALETTES`; `resolveNativeMermaidThemeVariables` GitHub-oriented for `auto` / `github-light` / `github-dark`
- Consumes: Task 1 settings types

- [ ] **Step 1: Write failing theme tests**

Update / add in `mermaidTheme.test.ts`:

```ts
it("maps github-light to GitHub preview colours", () => {
  document.documentElement.setAttribute("data-theme", "light");
  const vars = resolveNativeMermaidThemeVariables({
    ...MERMAID_SETTINGS_DEFAULTS,
    theme: "github-light",
  });
  expect(vars.darkMode).toBe(false);
  expect(vars.background).toBe("#ffffff");
  expect(vars.mainBkg).toBe("#f6f8fa");
  expect(vars.primaryBorderColor).toBe("#0969da");
  expect(vars.primaryTextColor).toBe("#24292f");
  expect(vars.lineColor).toBe("#57606a");
});

it("maps github-dark to GitHub dark preview colours", () => {
  const vars = resolveNativeMermaidThemeVariables({
    ...MERMAID_SETTINGS_DEFAULTS,
    theme: "github-dark",
  });
  expect(vars.darkMode).toBe(true);
  expect(vars.background).toBe("#0d1117");
  expect(vars.mainBkg).toBe("#161b22");
  expect(vars.primaryBorderColor).toBe("#58a6ff");
  expect(vars.primaryTextColor).toBe("#e6edf3");
  expect(vars.lineColor).toBe("#8b949e");
});
```

Keep Pele CSS var tests; update imports if renamed.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && pnpm exec vitest run src/utils/mermaidTheme.test.ts`

Expected: FAIL on `#0969da` / `#58a6ff` border expectations (current map uses grey borders from palette).

- [ ] **Step 3: Implement theme mapping**

1. Rename `BEAUTIFUL_MERMAID_PALETTES` → `MERMAID_PALETTES`.
2. Rename `resolveBeautifulMermaidPalette` → `resolveMermaidPalette` (export both old name as deprecated alias only if needed for one commit; prefer update all call sites).
3. For `resolveNativeMermaidThemeVariables`:
   - `github-light` / light `auto` → GitHub light hex set above; for `auto` prefer CSS tokens when present, else fall back to these GitHub hexes; set `primaryBorderColor` accent to `#0969da` when using GitHub light defaults.
   - `github-dark` / dark `auto` → GitHub dark hex set; accent border `#58a6ff` or `#4493f8`.
   - Other themes keep using `resolveMermaidPalette` as today.
4. Update `resolvePeleCssVariables` to call `resolveMermaidPalette`.

Suggested GitHub constants:

```ts
const GITHUB_LIGHT = {
  bg: "#ffffff",
  surface: "#f6f8fa",
  fg: "#24292f",
  line: "#57606a",
  border: "#0969da",
  muted: "#656d76",
};
const GITHUB_DARK = {
  bg: "#0d1117",
  surface: "#161b22",
  fg: "#e6edf3",
  line: "#8b949e",
  border: "#58a6ff",
  muted: "#8b949e",
};
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && pnpm exec vitest run src/utils/mermaidTheme.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/mermaidTheme.ts frontend/src/utils/mermaidTheme.test.ts
# plus any import renames
git commit -m "$(cat <<'EOF'
feat: map native mermaid colours to GitHub preview palettes

EOF
)"
```

---

### Task 3: MermaidBlock — remove beautiful path; neo + elk initialize

**Files:**
- Modify: `frontend/src/components/MarkdownViewer.tsx`
- Modify: `frontend/src/components/MermaidBlock.test.tsx`

**Interfaces:**
- Consumes: Task 1 renderer union; Task 2 theme helpers
- Produces: Native initialize with `look: "neo"`, `layout: "elk"`; render path pele → native only

- [ ] **Step 1: Write failing MermaidBlock tests**

1. Delete all tests that `setMermaidRenderer("beautiful")` or mock `beautiful-mermaid`.
2. Remove `vi.mock("beautiful-mermaid", …)` and `renderMermaidSVGMock` unless unused.
3. For native-selected test, assert initialize includes neo/elk:

```ts
it("uses native mermaid with neo look and elk layout when selected", async () => {
  setMermaidRenderer("native");
  vi.mocked(mermaid.render).mockResolvedValue({
    svg: '<svg width="360" height="180">native</svg>',
    bindFunctions: undefined,
    diagramType: "flowchart",
  });

  render(<MermaidBlock code="graph TD; A-->B" />);

  await waitFor(() => {
    expect(vi.mocked(mermaid.render)).toHaveBeenCalled();
  });
  expect(vi.mocked(mermaid.initialize)).toHaveBeenCalledWith(
    expect.objectContaining({
      theme: "base",
      look: "neo",
      layout: "elk",
      securityLevel: "strict",
      suppressErrorRendering: true,
      themeVariables: expect.objectContaining({
        fontFamily: "system-ui",
      }),
      flowchart: expect.objectContaining({
        htmlLabels: true,
        useMaxWidth: false,
      }),
    }),
  );
});
```

Keep default-pele and pele-fallback tests.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && pnpm exec vitest run src/components/MermaidBlock.test.tsx`

Expected: FAIL — initialize missing `look`/`layout`, and/or beautiful mocks still referenced.

- [ ] **Step 3: Implement MarkdownViewer changes**

1. Delete `beautifulMermaidRenderPromise`, `loadBeautifulMermaidRender`, `renderBeautifulMermaid`, `supportsBeautifulMermaid`, beautiful sequence-directive helpers, Google Fonts strip used only for beautiful.
2. In render effect: only `canUsePele` then native fallback.
3. Replace `initializeNativeMermaid` body with:

```ts
mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  suppressErrorRendering: true,
  look: "neo",
  layout: "elk",
  theme: "base",
  themeVariables: resolveNativeMermaidThemeVariables(getMermaidSettings()),
  flowchart: {
    htmlLabels: true,
    useMaxWidth: false,
  },
  sequence: {
    useMaxWidth: false,
  },
});
```

4. Fix imports: drop `beautiful-mermaid` / `resolveBeautifulMermaidPalette`; use `resolveMermaidPalette` only if still needed in this file (likely not).

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && pnpm exec vitest run src/components/MermaidBlock.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/MarkdownViewer.tsx frontend/src/components/MermaidBlock.test.tsx
git commit -m "$(cat <<'EOF'
feat: remove beautiful-mermaid path; native uses neo and elk

EOF
)"
```

---

### Task 4: Settings UI — two engines + Pele padding only

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx`
- Modify: `frontend/src/components/SettingsModal.test.tsx`

**Interfaces:**
- Consumes: Task 1 renderer union

- [ ] **Step 1: Write failing SettingsModal tests**

```ts
it("shows pele by default with only padding enabled among layout sliders", () => {
  render(<SettingsModal isOpen onClose={() => {}} />);
  const engine = screen.getByLabelText("渲染引擎") as HTMLSelectElement;
  expect(engine.value).toBe("pele");
  expect(screen.queryByRole("option", { name: /beautiful/i })).toBeNull();
  expect(screen.getByLabelText("画布边距")).not.toBeDisabled();
  expect(screen.queryByLabelText("节点间距")).toBeNull();
  expect(screen.queryByLabelText("层间距")).toBeNull();
  expect(screen.queryByLabelText("交叉优化")).toBeNull();
});

it("disables padding when switching to native", async () => {
  const user = userEvent.setup();
  render(<SettingsModal isOpen onClose={() => {}} />);
  await user.selectOptions(screen.getByLabelText("渲染引擎"), "native");
  expect(screen.getByLabelText("画布边距")).toBeDisabled();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && pnpm exec vitest run src/components/SettingsModal.test.tsx`

Expected: FAIL — beautiful option still present / node spacing still in DOM.

- [ ] **Step 3: Implement SettingsModal**

1. Options:

```tsx
<option value="pele">Pele（Obsidian，默认）</option>
<option value="native">原生 Mermaid</option>
```

2. Remove node/layer/thoroughness `SliderRow`s and beautiful help copy.
3. Keep padding slider; enable when `settings.renderer === "pele"`, disable for native.
4. Optional one-line note: `Pele 可调画布边距；原生使用 Mermaid neo + ELK 默认布局。`

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && pnpm exec vitest run src/components/SettingsModal.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/SettingsModal.tsx frontend/src/components/SettingsModal.test.tsx
git commit -m "$(cat <<'EOF'
feat: simplify mermaid settings to pele and native only

EOF
)"
```

---

### Task 5: Remove npm package + regression sweep

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml` (via pnpm)
- Modify: `CHANGELOG.md` (Unreleased or next section note)

**Interfaces:**
- Consumes: Tasks 1–4 (no remaining beautiful imports)

- [ ] **Step 1: Grep for leftovers**

Run: `rg -n "beautiful-mermaid|resolveBeautifulMermaidPalette|BEAUTIFUL_MERMAID|renderer === \"beautiful\"|\"beautiful\"" frontend/src frontend/package.json`

Expected: no product references (tests/docs history outside frontend/src OK to ignore).

- [ ] **Step 2: Remove dependency**

```bash
cd frontend && pnpm remove beautiful-mermaid
```

- [ ] **Step 3: Full related test run**

```bash
cd frontend && pnpm exec vitest run src/hooks/useMermaidSettings.test.ts src/utils/mermaidTheme.test.ts src/components/SettingsModal.test.tsx src/components/MermaidBlock.test.tsx
```

Expected: all PASS

- [ ] **Step 4: CHANGELOG bullet**

Under a new Unreleased or next version section:

```md
- feat: 移除 beautiful-mermaid；原生 Mermaid 使用 neo + ELK 并贴近 GitHub 配色；引擎仅 Pele（默认）/ 原生
```

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml CHANGELOG.md
git commit -m "$(cat <<'EOF'
chore: remove beautiful-mermaid dependency

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| Remove beautiful dependency / path / UI | 3, 4, 5 |
| Renderer `pele` \| `native`, default pele | 1 |
| Migrate stored beautiful → pele | 1 |
| Native `look: neo` + `layout: elk` | 3 |
| GitHub light/dark themeVariables | 2 |
| Rename beautiful palette helper | 2 |
| Keep Pele padding; drop beautiful sliders | 4 |
| Presets omit renderer | 1 |
| Out of scope items not implemented | — |
