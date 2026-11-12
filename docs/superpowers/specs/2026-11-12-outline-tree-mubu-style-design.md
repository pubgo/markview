# Outline tree → Mubu-style outline + minimal mindmap — Design

## Problem

The toolbar「缩进树」view (`OutlineTreeView`) uses a colourful G6 mindmap (rainbow strokes, card-like nodes, wide horizontal sprawl). Compared with mainstream outline tools (e.g. 幕布), it feels cluttered, hard to scan, and overlaps「标题结构图」without a clear job.

## Goal

Keep a **single** toolbar entry「缩进树」, and inside it offer two presentations of the **same outline data**:

1. **大纲（default）** — Mubu-like indented list: fold/expand, click to open docs.
2. **导图** — Same tree via G6, restyled to a minimal mindmap (muted strokes, light fills, no rainbow palette, prefer vertical by default).

Read-only navigation only — not an editable outline editor.

## Settled decisions

| Decision | Choice |
| -------- | ------ |
| Overall approach | A: one entry, dual presentation |
| Toolbar | Unchanged: one「缩进树」button |
| In-view toggle | `大纲 \| 导图` segmented control; **default 大纲** |
| Data source | Existing outline API + current tree build / collapse logic |
| Outline UI | New indented list (DOM), not G6 |
| Mindmap | Keep G6 + current tree; restyle only |
| Mindmap default direction | Vertical (`V`); keep H/V toggle in 导图 mode |
| Click / open (大纲) | Chevron toggles collapse; clicking the label opens the target (file / heading / link). No modifier required. |
| Click / open (导图) | Keep today’s G6 behaviour: collapsible nodes toggle on click; Ctrl/Cmd+click opens when the node is also collapsible; plain click opens leaf targets. |
| Theme | GitHub CSS tokens (`--color-gh-*`) for list; mindmap colours derived from light/dark theme (single accent family, not per-file rainbow) |
| Persistence | Always remember last mode (`大纲`/`导图`) in `localStorage`; layout direction key already exists |

## Out of scope

- Editable outline / drag reorder / inline rename (幕布 editing)
- Real-time collaboration
- Changing「链接关系图」or「标题结构图」
- Replacing G6 with another mindmap library
- Removing the toolbar entry

## Behaviour

### Toolbar / shell

- `App.tsx` keeps `graphViewMode === "tree"` → `OutlineTreeView`.
- Inside `OutlineTreeView` header:
  - 「返回文档」(when not embedded)
  - Segmented `大纲 | 导图`
  - When `导图`: existing 横向/纵向 toggle
  - Short help text updated to match dual mode (drop “思维导图：…” wall of text or shrink to one line)

### Shared data

- Continue `fetchOutline()` → build hierarchical nodes: file → H1 → H2 → linked files (existing `outlineToTreeData` / collapse helpers).
- Collapse state shared across modes when practical (same `collapsedIds`), so folding in 大纲 reflects in 导图 and vice versa.

### 大纲 mode

- Render a scrollable list:
  - Indent by depth (e.g. 16–20px per level).
  - Collapse chevron only when the node has children; otherwise spacer for alignment.
  - Single-line label with ellipsis; no coloured borders/cards.
  - Hover/focus use `bg-gh-bg-hover`; text `text-gh-text` / secondary for meta if any.
- Interaction:
  - Chevron (or row affordance) toggles collapse.
  - Primary click on label opens the document/heading target (same navigation helpers as today).
- Empty / loading / error: reuse current empty states.

### 导图 mode

- Keep G6 `mindmap` layout and behaviours (pan/zoom/scroll).
- Visual changes vs today:
  - Stroke/edge: one muted colour from theme (e.g. border / text-secondary), not `COLORS[fileColorIndex]`.
  - Node fill: page/surface tokens; root slightly stronger surface.
  - Drop dashed “collapsed” rainbow emphasis; keep a subtle collapsed cue (e.g. weaker stroke or chevron in label only).
  - Tighter, consistent label typography; avoid large root-only styling mismatch.
- Default `layoutDirection` for new users: `V` (update default when no localStorage value). Existing saved `H`/`V` still respected.

### Docs

- Update README / quick-start / strategy-status mentions of「缩进树」to note 大纲+导图 dual mode briefly.

## Testing

- Component tests: default mode is 大纲; toggle shows 导图 container; collapse toggles children in list.
- Smoke: theme light/dark list contrast; mindmap renders without throwing after restyle.
- No requirement for visual screenshot CI unless already present for graph views.

## Success criteria

- Default open of「缩进树」reads as a clean outline list (幕布-like), scannable without pan/zoom.
- 导图 is usable but visually quiet and does not compete with「标题结构图」via loud colour coding.
- Toolbar graph button count unchanged.
