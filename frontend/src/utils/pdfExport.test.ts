import { describe, expect, it, afterEach } from "vitest";
import {
  countPendingDiagramRenders,
  planCapture,
  resolvePdfCaptureBackgroundColor,
  toPdfFilename,
  toSlidesDeckPdfFilename,
} from "./pdfExport";

describe("toPdfFilename", () => {
  it("returns document.pdf for empty name", () => {
    expect(toPdfFilename("")).toBe("document.pdf");
  });

  it("converts .md to .pdf", () => {
    expect(toPdfFilename("README.md")).toBe("README.pdf");
  });

  it("converts .mdx to .pdf", () => {
    expect(toPdfFilename("sample.mdx")).toBe("sample.pdf");
  });

  it("keeps .pdf unchanged", () => {
    expect(toPdfFilename("guide.pdf")).toBe("guide.pdf");
  });

  it("appends .pdf when no extension", () => {
    expect(toPdfFilename("notes")).toBe("notes.pdf");
  });
});

describe("toSlidesDeckPdfFilename", () => {
  it("appends -deck before .pdf", () => {
    expect(toSlidesDeckPdfFilename("talk.md")).toBe("talk-deck.pdf");
  });

  it("does not double-append -deck", () => {
    expect(toSlidesDeckPdfFilename("talk-deck.md")).toBe("talk-deck.pdf");
  });
});

describe("resolvePdfCaptureBackgroundColor", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.removeProperty("--color-gh-bg");
  });

  it("uses dark page background when data-theme is dark", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    expect(resolvePdfCaptureBackgroundColor()).toBe("#0d1117");
  });

  it("uses light page background by default", () => {
    document.documentElement.removeAttribute("data-theme");
    expect(resolvePdfCaptureBackgroundColor()).toBe("#ffffff");
  });

  it("prefers --color-gh-bg when set", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.style.setProperty("--color-gh-bg", "#111827");
    expect(resolvePdfCaptureBackgroundColor()).toBe("#111827");
  });
});

describe("planCapture", () => {
  const tileLimits = (width: number, sliceHeight: number, ratio: number) => ({
    edgePx: sliceHeight * ratio,
    areaPx: width * sliceHeight * ratio * ratio,
  });

  it("captures short pages in a single slice at display ratio", () => {
    const plan = planCapture(1120, 648, 2);
    expect(plan.ratio).toBe(4);
    expect(plan.slices).toHaveLength(1);
    expect(plan.slices[0]).toEqual({ topPx: 0, heightPx: 648 });
  });

  it("keeps the 2x floor on low-dpi screens", () => {
    expect(planCapture(1120, 648, 1).ratio).toBe(2);
  });

  it("tiles tall documents at display ratio instead of dropping to 1x", () => {
    const plan = planCapture(980, 19107, 1);
    expect(plan.ratio).toBe(2);
    expect(plan.slices.length).toBeGreaterThan(1);
    // Slices must cover the article exactly, in order.
    let top = 0;
    for (const slice of plan.slices) {
      expect(slice.topPx).toBe(top);
      top += slice.heightPx;
      const { edgePx, areaPx } = tileLimits(980, slice.heightPx, plan.ratio);
      expect(edgePx).toBeLessThanOrEqual(16384);
      expect(areaPx).toBeLessThanOrEqual(64 * 1024 * 1024);
    }
    expect(top).toBe(19107);
  });

  it("caps the ratio at 4x regardless of device pixel ratio", () => {
    const plan = planCapture(1120, 648, 3);
    expect(plan.ratio).toBe(4);
  });

  it("keeps every tile inside canvas budgets even on very tall pages", () => {
    for (const dpr of [1, 2, 3]) {
      const plan = planCapture(980, 19107, dpr);
      for (const slice of plan.slices) {
        const { edgePx, areaPx } = tileLimits(980, slice.heightPx, plan.ratio);
        expect(edgePx).toBeLessThanOrEqual(16384);
        expect(areaPx).toBeLessThanOrEqual(64 * 1024 * 1024);
      }
      const covered = plan.slices.reduce((sum, s) => sum + s.heightPx, 0);
      expect(covered).toBe(19107);
    }
  });

  it("handles degenerate sizes without NaN", () => {
    const plan = planCapture(0, 0, 2);
    expect(plan.slices.length).toBeGreaterThan(0);
    for (const slice of plan.slices) {
      expect(Number.isFinite(slice.heightPx)).toBe(true);
      expect(slice.heightPx).toBeGreaterThan(0);
    }
  });
});

describe("countPendingDiagramRenders", () => {
  it("counts pending mermaid, plantuml, and svgbob blocks", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-mermaid-render-status="pending"></div>
      <div data-mermaid-render-status="rendered"></div>
      <div data-plantuml-render-status="pending"></div>
      <div data-svgbob-render-status="pending"></div>
      <div data-svgbob-render-status="failed"></div>
    `;
    expect(countPendingDiagramRenders(root)).toBe(3);
  });

  it("returns zero when no diagrams are pending", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-mermaid-render-status="rendered"></div>
      <div data-plantuml-render-status="failed"></div>
    `;
    expect(countPendingDiagramRenders(root)).toBe(0);
  });
});
