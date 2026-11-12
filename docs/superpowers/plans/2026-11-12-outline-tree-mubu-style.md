# Outline Tree Mubu-Style Dual Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the loud G6-only「缩进树」with a Mubu-like **大纲** list (default) plus a minimal **导图** mindmap, sharing one outline tree and one toolbar entry.

**Architecture:** Keep `OutlineTreeView` as the shell (fetch outline, collapse state, mode toggle, return button). Add a DOM indented list for 大纲. Keep G6 mindmap for 导图 but restyle to a single muted palette and default vertical layout. Share `outlineToTreeData` / collapse helpers so folding stays in sync across modes.

**Tech Stack:** React 19, AntV G6 (existing), Vitest + Testing Library, `localStorage`, GitHub CSS tokens in `app.css` / Tailwind `gh-*` classes.

**Spec:** `docs/superpowers/specs/2026-11-12-outline-tree-mubu-style-design.md`

## Global Constraints

- Toolbar still has exactly one「缩进树」entry (`graphViewMode === "tree"`).
- In-view modes: `大纲 | 导图`; **default 大纲**; persist mode in `localStorage`.
- Read-only navigation only — no edit/drag/rename.
- 大纲: chevron collapses; label click opens target (no modifier required).
- 导图: keep today’s G6 click rules (collapse vs Ctrl/Cmd+click open).
- Mindmap: no per-file rainbow strokes; theme-derived muted colours; default direction `V` when unset.
- Do not change「链接关系图」or「标题结构图」.
- No new npm dependencies.

## File map

| File | Responsibility |
| ---- | -------------- |
| `frontend/src/components/outlineTreeModel.ts` | Shared tree types + `outlineToTreeData` / collapse helpers (extracted from `OutlineTreeView.tsx`) |
| `frontend/src/components/outlineTreeModel.test.ts` | Unit tests for tree build + default collapse |
| `frontend/src/components/OutlineTreeList.tsx` | Mubu-style indented list UI |
| `frontend/src/components/OutlineTreeList.test.tsx` | List render / collapse / open callbacks |
| `frontend/src/components/OutlineTreeView.tsx` | Shell: fetch, mode toggle, wire list + restyled G6 |
| `frontend/src/components/OutlineTreeView.test.tsx` | Default mode, toggle, persistence |
| `README.md` / `docs/quick-start-visual.md` / `docs/strategy-status.md` | Brief dual-mode note |

---

### Task 1: Extract outline tree model

**Files:**
- Create: `frontend/src/components/outlineTreeModel.ts`
- Create: `frontend/src/components/outlineTreeModel.test.ts`
- Modify: `frontend/src/components/OutlineTreeView.tsx` (import from model; delete duplicated helpers)

**Interfaces:**
- Produces:
  - `export type OutlineTreeNodeData = { value: string; depth?: number; fileId?: string; group?: string; targetFileId?: string; targetGroup?: string; isFile?: boolean; isH1?: boolean; isH2?: boolean; isLink?: boolean; hasLinks?: boolean; hasChildren?: boolean; fileColorIndex?: number }`
  - `export type OutlineTreeNode = { id: string; data: OutlineTreeNodeData; children?: OutlineTreeNode[] }`
  - `export function outlineToTreeData(outline: Outline, collapsedIds: Set<string>): OutlineTreeNode`
  - `export function collectDefaultCollapsedIds(outline: Outline): Set<string>`
  - `export const OUTLINE_TREE_ROOT_ID = "root"`

- [ ] **Step 1: Write failing model tests**

Create `frontend/src/components/outlineTreeModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Outline } from "../hooks/useApi";
import {
  collectDefaultCollapsedIds,
  outlineToTreeData,
  OUTLINE_TREE_ROOT_ID,
} from "./outlineTreeModel";

function sampleOutline(): Outline {
  return {
    files: [
      {
        id: "a1",
        name: "alpha.md",
        group: "default",
        headings: [
          { level: 1, text: "Alpha", linkedFileIds: [] },
          { level: 2, text: "Detail", linkedFileIds: ["b2"] },
        ],
      },
      {
        id: "b2",
        name: "beta.md",
        group: "default",
        headings: [{ level: 1, text: "Beta", linkedFileIds: [] }],
      },
    ],
  } as Outline;
}

describe("outlineToTreeData", () => {
  it("builds root → files → headings with depths", () => {
    const root = outlineToTreeData(sampleOutline(), new Set());
    expect(root.id).toBe(OUTLINE_TREE_ROOT_ID);
    expect(root.children?.length).toBeGreaterThan(0);
    const file = root.children![0];
    expect(file.data.isFile).toBe(true);
    expect(file.data.depth).toBe(1);
  });

  it("omits children when file id is collapsed", () => {
    const collapsed = new Set(["fl_a1"]);
    const root = outlineToTreeData(sampleOutline(), collapsed);
    const file = root.children!.find((c) => c.id === "fl_a1");
    expect(file?.children).toBeUndefined();
  });
});

describe("collectDefaultCollapsedIds", () => {
  it("returns a Set including root or files for large outlines", () => {
    const ids = collectDefaultCollapsedIds(sampleOutline());
    expect(ids).toBeInstanceOf(Set);
  });
});
```

Adjust the fixture to match the real `Outline` type fields in `frontend/src/hooks/useApi.ts` (copy required properties from that type; do not invent fields the API does not have).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && pnpm exec vitest run src/components/outlineTreeModel.test.ts`

Expected: FAIL (module / exports missing).

- [ ] **Step 3: Extract implementation**

Move from `OutlineTreeView.tsx` into `outlineTreeModel.ts` without behaviour change:

- `TreeDataNode` / data types (rename to `OutlineTreeNode` / `OutlineTreeNodeData` if clearer)
- `buildFileOutline`, `findRootFiles`, `collectDefaultCollapsedIds`, `outlineToTreeData`, `MANY_FILES_THRESHOLD`, `COLORS` (keep `COLORS` export only if mindmap still needs file index for something; after restyle mindmap should not use rainbow — index may remain unused or deleted later in Task 4)
- Helpers that only the tree builder needs

Re-export what `OutlineTreeView` still needs. Update imports in `OutlineTreeView.tsx`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && pnpm exec vitest run src/components/outlineTreeModel.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/outlineTreeModel.ts frontend/src/components/outlineTreeModel.test.ts frontend/src/components/OutlineTreeView.tsx
git commit -m "refactor: extract outline tree model from OutlineTreeView"
```

---

### Task 2: Outline list component (大纲)

**Files:**
- Create: `frontend/src/components/OutlineTreeList.tsx`
- Create: `frontend/src/components/OutlineTreeList.test.tsx`

**Interfaces:**
- Consumes: `OutlineTreeNode` from `outlineTreeModel.ts`
- Produces:

```ts
export function OutlineTreeList(props: {
  root: OutlineTreeNode;
  collapsedIds: Set<string>;
  onToggleCollapse: (nodeId: string) => void;
  onOpenNode: (data: OutlineTreeNode["data"]) => void;
}): JSX.Element
```

- [ ] **Step 1: Write failing list tests**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutlineTreeList } from "./OutlineTreeList";
import type { OutlineTreeNode } from "./outlineTreeModel";

const root: OutlineTreeNode = {
  id: "root",
  data: { value: "文档", depth: 0 },
  children: [
    {
      id: "fl_a1",
      data: {
        value: "alpha.md",
        depth: 1,
        isFile: true,
        hasChildren: true,
        fileId: "a1",
        group: "default",
      },
      children: [
        {
          id: "h1",
          data: { value: "Alpha", depth: 2, isH1: true, fileId: "a1", group: "default" },
        },
      ],
    },
  ],
};

describe("OutlineTreeList", () => {
  it("renders indented labels and hides children when collapsed", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    const { rerender } = render(
      <OutlineTreeList
        root={root}
        collapsedIds={new Set()}
        onToggleCollapse={onToggle}
        onOpenNode={onOpen}
      />,
    );
    expect(screen.getByText("alpha.md")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();

    rerender(
      <OutlineTreeList
        root={root}
        collapsedIds={new Set(["fl_a1"])}
        onToggleCollapse={onToggle}
        onOpenNode={onOpen}
      />,
    );
    // When parent passes a tree already pruned by outlineToTreeData, children may be absent;
    // list should still show the file row and a collapsed chevron affordance.
    expect(screen.getByText("alpha.md")).toBeTruthy();
  });

  it("chevron toggles collapse; label click opens", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    render(
      <OutlineTreeList
        root={root}
        collapsedIds={new Set()}
        onToggleCollapse={onToggle}
        onOpenNode={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /collapse alpha\.md|expand alpha\.md/i }));
    expect(onToggle).toHaveBeenCalledWith("fl_a1");
    fireEvent.click(screen.getByText("Alpha"));
    expect(onOpen).toHaveBeenCalled();
  });
});
```

If accessible names are awkward, use `data-testid={`outline-tree-toggle-${id}`}` and assert those in tests — prefer stable test ids over brittle regex.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && pnpm exec vitest run src/components/OutlineTreeList.test.tsx`

Expected: FAIL (component missing).

- [ ] **Step 3: Implement `OutlineTreeList`**

Requirements:

- Flatten visible nodes from `root` (skip `root` label row or show it as a non-clickable header — pick **skip root row**, start at file children, matching “文件为根” mental model).
- Each row: `paddingLeft: depth * 16` (or `depth * 20`), chevron button if `hasChildren` / children present / collapsed with hasChildren, else spacer.
- Classes: `text-gh-text`, hover `bg-gh-bg-hover`, truncate label.
- Chevron calls `onToggleCollapse(id)`; label/`button` for text calls `onOpenNode(data)`.
- Stop propagation so chevron does not also open.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && pnpm exec vitest run src/components/OutlineTreeList.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/OutlineTreeList.tsx frontend/src/components/OutlineTreeList.test.tsx
git commit -m "feat: add Mubu-style outline tree list"
```

---

### Task 3: Wire dual mode into `OutlineTreeView`

**Files:**
- Modify: `frontend/src/components/OutlineTreeView.tsx`
- Create: `frontend/src/components/OutlineTreeView.test.tsx`

**Interfaces:**
- Consumes: `OutlineTreeList`, `outlineToTreeData`, mode key `markview-outline-tree-mode` with values `"list" | "mindmap"`
- Produces: default UI mode `"list"`; segmented control labels「大纲」「导图」

- [ ] **Step 1: Write failing shell tests**

Mock `fetchOutline` to resolve a tiny outline. Assert:

```ts
it("defaults to 大纲 list mode", async () => {
  // render OutlineTreeView
  expect(await screen.findByRole("tab", { name: "大纲" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByText("alpha.md")).toBeTruthy(); // from list
});

it("switches to 导图 and persists mode", async () => {
  // click 导图
  expect(localStorage.getItem("markview-outline-tree-mode")).toBe("mindmap");
  // mindmap container exists (e.g. data-testid="outline-tree-mindmap")
});
```

Use the project’s existing API mock patterns (see other component tests that call `fetchOutline` / `useApi`). If G6 cannot mount in jsdom, stub the mindmap branch behind `data-testid` and only assert the container mounts when mode is mindmap (do not require full G6 canvas).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd frontend && pnpm exec vitest run src/components/OutlineTreeView.test.tsx`

Expected: FAIL

- [ ] **Step 3: Implement shell wiring**

In `OutlineTreeView.tsx`:

1. State `presentation: "list" | "mindmap"` from `localStorage` key `markview-outline-tree-mode` (default `"list"`).
2. Header: keep 返回文档; add two toggle buttons/tabs「大纲」「导图」; show 横向/纵向 **only** when `presentation === "mindmap"`.
3. When `list`: render `<OutlineTreeList root={outlineToTreeData(...)} ... />` with existing `collapsedIds` / `toggleCollapse` / open handler extracted from today’s `handleNodeClick` (map list open to same URL / `onSelectFile` behaviour).
4. When `mindmap`: keep existing G6 effect, wrap container with `data-testid="outline-tree-mindmap"`.
5. Replace the long help sentence with a short one-liner for the active mode.
6. Only run the G6 `useEffect` when `presentation === "mindmap"` (avoid building Graph while on list).

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && pnpm exec vitest run src/components/OutlineTreeView.test.tsx src/components/OutlineTreeList.test.tsx src/components/outlineTreeModel.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/OutlineTreeView.tsx frontend/src/components/OutlineTreeView.test.tsx
git commit -m "feat: add 大纲/导图 toggle to outline tree view"
```

---

### Task 4: Minimal mindmap restyle + default vertical

**Files:**
- Modify: `frontend/src/components/OutlineTreeView.tsx` (G6 `node`/`edge` style + default direction)

**Interfaces:**
- Produces: default `layoutDirection === "V"` when `localStorage` missing; strokes/fills from theme tokens (no `COLORS[fileColorIndex]` for stroke/edge)

- [ ] **Step 1: Write a focused regression assertion**

Extend `OutlineTreeView.test.tsx` (or model test if cleaner):

```ts
it("defaults layout direction to V when unset", () => {
  localStorage.removeItem("markview-outline-layout-direction");
  // mount mindmap mode
  // assert the 纵向 button is the active label OR read state via toggle title
});
```

If direction state is hard to observe without G6, assert by reading the toggle button text after mount in mindmap mode: initial label should be「纵向」when storage empty (matching current control that displays current direction).

- [ ] **Step 2: Run — expect FAIL** (still defaults to `H`)

- [ ] **Step 3: Restyle G6**

In the Graph config inside `OutlineTreeView.tsx`:

- Change `useState` initializer for `layoutDirection` default from `"H"` to `"V"`.
- Node `stroke` / edge `stroke`: use muted theme colour (`isDark ? "#8b949e" : "#656d76"` or border token equivalents), **not** `COLORS[colorIdx]`.
- Node `fill`: surface (`isDark ? "#161b22" : "#ffffff"`); root slightly stronger (`#21262d` / `#f6f8fa`).
- Remove rainbow dependency from edge/node stroke; delete unused `COLORS` import/usage if nothing else needs it.
- Keep collapse chevron in `labelText`; keep ports/layout type `mindmap`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd frontend && pnpm exec vitest run src/components/OutlineTreeView.test.tsx`

Expected: PASS

- [ ] **Step 5: Manual smoke (local)**

Run markview, open「缩进树」:

- Lands on 大纲 list; fold/unfold; click opens doc.
- Switch 导图: quiet colours, vertical default; toggle 横向 works.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/OutlineTreeView.tsx frontend/src/components/OutlineTreeView.test.tsx
git commit -m "fix: restyle outline mindmap and default to vertical"
```

---

### Task 5: Docs touch-up

**Files:**
- Modify: `README.md` (graph bullet)
- Modify: `docs/quick-start-visual.md` (section 3)
- Modify: `docs/strategy-status.md` (graph line)
- Modify: `CHANGELOG.md` Unreleased

- [ ] **Step 1: Update copy**

State that「缩进树」supports **大纲（默认）** and **导图** dual presentation. Do not rewrite unrelated sections.

Example README bullet:

```markdown
- 文档链接图谱与大纲视图（链接图 / 结构图 / 缩进树：大纲+导图）
```

CHANGELOG Unreleased:

```markdown
- feat: 缩进树改为幕布式大纲（默认）+ 极简导图双呈现
```

- [ ] **Step 2: Commit**

```bash
git add README.md docs/quick-start-visual.md docs/strategy-status.md CHANGELOG.md
git commit -m "docs: note outline tree dual 大纲/导图 modes"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| ---------------- | ---- |
| Single toolbar entry | unchanged; Task 3 |
| `大纲 \| 导图`, default 大纲 | Task 3 |
| Persist mode | Task 3 |
| Shared outline data + collapse | Tasks 1–3 |
| Mubu-like list UI | Task 2 |
| List click/collapse rules | Task 2–3 |
| Minimal G6 mindmap | Task 4 |
| Default vertical mindmap | Task 4 |
| Docs | Task 5 |
| Out of scope (no edit, no other graphs) | respected |

## Plan self-review

- No TBD/placeholder steps.
- Types named consistently: `OutlineTreeNode`, mode `"list" | "mindmap"`, storage `markview-outline-tree-mode`.
- G6 jsdom limitation handled by testing container presence, not canvas pixels.
