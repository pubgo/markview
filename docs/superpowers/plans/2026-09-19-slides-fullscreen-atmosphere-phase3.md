# Slides Fullscreen Atmosphere (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make fullscreen Slides feel like a presentation stage (near-bleed surface, cohesive backdrop, calmer chrome) via CSS only, without changing reading mode or non-fullscreen slides preview.

**Architecture:** Extend existing `.markdown-slide-shell:fullscreen` / `--fullscreen` rules in `app.css` with light/dark stage gradients, a flatter slide surface, and slight content contrast boosts. Add one regression assertion on the fullscreen shell class.

**Tech Stack:** React + Vitest + Testing Library (existing), plain CSS variables (`--color-gh-*`).

## Global Constraints

- CSS-only preferred; no Marp runtime; no new dependencies.
- Scope limited to fullscreen selectors; non-fullscreen slides and reading mode unchanged.
- Stay on `--color-gh-*`; no purple-on-white or cream/terracotta defaults.
- Light-theme fullscreen stage must not be harsh pure black.

---

### Task 1: Fullscreen shell class regression test

**Files:**
- Modify: `frontend/src/components/MarkdownViewer.slides.test.tsx`
- Test: same file

**Interfaces:**
- Consumes: existing Slides toggle + `全屏展示` button; `requestFullscreen` mock from `beforeEach`
- Produces: assertion that `data-testid="markdown-slide-shell"` has class `markdown-slide-shell--fullscreen` after fullscreen click

- [ ] **Step 1: Write the failing/extended test**

Extend the existing `"enters fullscreen when clicking fullscreen button"` test (or add a sibling) so it also asserts the shell class:

```tsx
    it("enters fullscreen when clicking fullscreen button", async () => {
        const user = userEvent.setup();

        render(
            <MarkdownViewer
                fileId="file-1"
                fileName="README.md"
                revision={0}
                onFileOpened={() => { }}
                onHeadingsChange={() => { }}
                isTocOpen={false}
                onTocToggle={() => { }}
                onRemoveFile={() => { }}
                isWide={false}
            />,
        );

        await screen.findByText("第一页内容");
        await user.click(screen.getByRole("button", { name: "Slides" }));

        await user.click(screen.getByRole("button", { name: "全屏展示" }));
        expect(requestFullscreenMock).toHaveBeenCalledOnce();

        await waitFor(() => {
            const shell = screen.getByTestId("markdown-slide-shell");
            expect(shell.className).toContain("markdown-slide-shell--fullscreen");
        });
    });
```

- [ ] **Step 2: Run test**

Run: `cd frontend && npm test -- --run src/components/MarkdownViewer.slides.test.tsx`

Expected: PASS if `fullscreenchange` already flips `isSlidesFullscreen` after the mock sets `fullscreenElement`. If it fails because state never updates, fire `fullscreenchange` after the click:

```tsx
        await user.click(screen.getByRole("button", { name: "全屏展示" }));
        document.dispatchEvent(new Event("fullscreenchange"));
        await waitFor(() => {
            expect(screen.getByTestId("markdown-slide-shell").className).toContain(
                "markdown-slide-shell--fullscreen",
            );
        });
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/MarkdownViewer.slides.test.tsx
git commit -m "test: assert slides shell fullscreen class"
```

---

### Task 2: Stage + surface CSS for fullscreen

**Files:**
- Modify: `frontend/src/styles/app.css` (`.markdown-slide-shell:fullscreen` block ~274–307)

**Interfaces:**
- Consumes: existing `:fullscreen` / `--overlay-hidden` rules
- Produces: cohesive stage + near-bleed slide surface for light and dark

- [ ] **Step 1: Replace/extend the fullscreen shell/page rules**

Replace the current fullscreen block starting at `.markdown-slide-shell:fullscreen` through `:fullscreen::backdrop` with:

```css
.markdown-slide-shell:fullscreen {
  width: 100%;
  height: 100%;
  padding: min(1.2vw, 14px);
  display: flex;
  align-items: center;
  justify-content: center;
  /* Light theme: soft neutral stage (not harsh black) */
  background:
    radial-gradient(ellipse 90% 70% at 50% 0%, #cbd5e1 0%, transparent 55%),
    linear-gradient(165deg, #e2e8f0 0%, #94a3b8 55%, #64748b 100%);
}

[data-theme="dark"] .markdown-slide-shell:fullscreen {
  background:
    radial-gradient(ellipse 90% 70% at 50% -10%, #1e293b 0%, transparent 50%),
    linear-gradient(165deg, #0f172a 0%, #111827 55%, #0b1020 100%);
}

.markdown-slide-shell:fullscreen .markdown-slide-page {
  width: min(98vw, 1680px);
  height: min(96vh, 980px);
  max-height: none;
  border-radius: 8px;
  border-color: color-mix(in oklab, var(--color-gh-border) 70%, transparent);
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
  background: var(--color-gh-bg);
}

[data-theme="dark"] .markdown-slide-shell:fullscreen .markdown-slide-page {
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.45);
  border-color: color-mix(in oklab, var(--color-gh-border) 80%, transparent);
}

.markdown-slide-shell:fullscreen .markdown-slide-help-badge {
  bottom: min(2vh, 16px);
  right: min(2vw, 18px);
  opacity: 0.85;
}

.markdown-slide-shell:fullscreen .markdown-slide-fullscreen-btn {
  opacity: 0.9;
}

.markdown-slide-shell--overlay-hidden:fullscreen .markdown-slide-fullscreen-btn,
.markdown-slide-shell--overlay-hidden:fullscreen .markdown-slide-help-badge {
  opacity: 0;
}

.markdown-slide-shell--overlay-hidden:fullscreen .markdown-slide-fullscreen-btn {
  pointer-events: none;
}

.markdown-slide-shell:fullscreen::backdrop {
  background: #64748b;
}

[data-theme="dark"] .markdown-slide-shell:fullscreen::backdrop {
  background: #0b1020;
}
```

Keep any non-conflicting rules; remove obsolete duplicate padding/size/backdrop definitions that this block supersedes.

- [ ] **Step 2: Sanity-check non-fullscreen rules untouched**

Confirm `.markdown-slide-page` (non-fullscreen) still has `border-radius: 12px` and original `min-height` / `aspect-ratio`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/app.css
git commit -m "feat: stage and near-bleed surface for fullscreen slides"
```

---

### Task 3: Fullscreen content contrast polish

**Files:**
- Modify: `frontend/src/styles/app.css` (after Task 2 fullscreen block)

**Interfaces:**
- Consumes: Task 2 fullscreen selectors
- Produces: cover/title/blockquote/table emphasis only under `:fullscreen`

- [ ] **Step 1: Add fullscreen-only content rules**

Append after the fullscreen shell block:

```css
.markdown-slide-shell:fullscreen .markdown-slide-page--cover h1,
.markdown-slide-shell:fullscreen .markdown-slide-page--cover h2 {
  font-size: clamp(2.6rem, 5vw, 4rem);
  letter-spacing: -0.025em;
}

.markdown-slide-shell:fullscreen .markdown-slide-page blockquote {
  border-left-width: 5px;
  border-left-color: color-mix(in oklab, var(--color-gh-text) 35%, var(--color-gh-border));
  background: color-mix(in oklab, var(--color-gh-bg-secondary) 88%, var(--color-gh-text) 4%);
}

.markdown-slide-shell:fullscreen .markdown-slide-page th {
  background: color-mix(in oklab, var(--color-gh-bg-secondary) 80%, var(--color-gh-text) 6%);
}

.markdown-slide-shell:fullscreen .markdown-slide-page img {
  max-height: min(70vh, 720px);
  max-height: min(70dvh, 720px);
  border-radius: 8px;
}
```

- [ ] **Step 2: Run slides + mermaid tests**

Run: `cd frontend && npm test -- --run src/components/MarkdownViewer.slides.test.tsx src/components/MermaidBlock.test.tsx`

Expected: all PASS

- [ ] **Step 3: Rebuild install for manual check**

Run: `cd /Users/barry/git/markview && make install`

Manual: open `testdata/slides-media.md` → Slides → F; check light and dark (`data-theme`), cover + table + image + Mermaid.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/app.css
git commit -m "feat: strengthen fullscreen slide content contrast"
```

---

## Spec coverage check

| Spec requirement | Task |
| ---------------- | ---- |
| Stage background light/dark | Task 2 |
| Near-bleed surface, less card chrome | Task 2 |
| Content contrast (cover/quote/table) | Task 3 |
| Chrome remains secondary / auto-hide | Task 2 (opacity + existing overlay-hidden) |
| Non-fullscreen / reading unchanged | Task 2 step 2 + CSS selector scope |
| Automated class regression | Task 1 |
| Manual media fixtures | Task 3 step 3 |
