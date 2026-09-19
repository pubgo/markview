# Slides Rendering Polish Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make in-app Slides look presentation-like via CSS theme + auto cover centering, without changing reading mode or the Markdown pipeline.

**Architecture:** Add `isSlideCover(markdown)` heuristic; toggle `markdown-slide-page--cover` on the slide section; expand `.markdown-body--slides` CSS for typography/spacing; hide heading chevrons in slides.

**Tech Stack:** React + existing MarkdownViewer, Vitest, CSS variables (`--color-gh-*`).

## Global Constraints

- Phase 1 = typography & layout only (no Mermaid/code/fullscreen atmosphere).
- Presentation CSS under slides selectors only; reading mode unchanged.
- Cover: auto-detect short title slides; use existing light/dark tokens.
- No new heavy dependencies; no Marp runtime.

---

### Task 1: `isSlideCover` helper + unit tests

**Files:**
- Create: `frontend/src/utils/slideCover.ts`
- Create: `frontend/src/utils/slideCover.test.ts`

**Interfaces:**
- Produces: `export function isSlideCover(markdown: string): boolean`

- [ ] **Step 1: Write tests** covering title-only (true), title + short line (true), list (false), fence (false), long paragraph (false), multiple headings (false).

- [ ] **Step 2: Implement** source-line heuristic per design (ignore blanks; one `#`/`##`; ≤2 short paragraphs ≤80 chars; reject lists/tables/fences/blockquotes).

- [ ] **Step 3: Run** `cd frontend && pnpm test src/utils/slideCover.test.ts`

- [ ] **Step 4: Commit**

---

### Task 2: Wire cover class + hide chevrons in slides

**Files:**
- Modify: `frontend/src/components/MarkdownViewer.tsx`
- Modify: `frontend/src/components/MarkdownViewer.slides.test.tsx`

**Interfaces:**
- Consumes: `isSlideCover` from `../utils/slideCover`

- [ ] **Step 1: Test** that slides mode adds `markdown-slide-page--cover` for a title-only first slide; list slide does not.

- [ ] **Step 2: Implement** conditional class on `<section className="markdown-slide-page">`; in slides heading render path, omit CollapsibleHeading chevron (plain heading or `collapsible={false}`).

- [ ] **Step 3: Run slides tests**

- [ ] **Step 4: Commit**

---

### Task 3: Presentation CSS theme

**Files:**
- Modify: `frontend/src/styles/app.css`

- [ ] **Step 1: Expand** `.markdown-body--slides .markdown-slide-page` typography (h1–h3, p/li, blockquote, strong, padding).

- [ ] **Step 2: Add** `.markdown-slide-page--cover` flex center + centered text.

- [ ] **Step 3: Hide** chevron span in slides if still present via CSS fallback.

- [ ] **Step 4: Commit**

---

### Task 4: Verify

- [ ] `cd frontend && pnpm test src/utils/slideCover.test.ts src/components/MarkdownViewer.slides.test.tsx src/components/MermaidBlock.test.tsx`
- [ ] Brief README tip under Slides section if useful (one line on auto cover) — optional

---

## Spec coverage

| Spec item | Task |
| --------- | ---- |
| Presentation typography | Task 3 |
| Auto cover | Tasks 1–2 |
| Hide chevrons | Tasks 2–3 |
| Reading mode unchanged | Tasks 2–3 (scoped selectors) |
| Tests | Tasks 1–2, 4 |
