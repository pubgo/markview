import { describe, expect, it, afterEach } from "vitest";
import {
  canvasToJpegDataUrl,
  countPendingDiagramRenders,
  normalizeCssHexColor,
  PDF_MAX_PAGE_HEIGHT_MM,
  PDF_SAFE_PAGE_HEIGHT_MM,
  planCapture,
  planContentPages,
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

describe("normalizeCssHexColor", () => {
  it("expands 3-digit hex from getComputedStyle", () => {
    expect(normalizeCssHexColor("#fff")).toBe("#ffffff");
    expect(normalizeCssHexColor("#0d1")).toBe("#00dd11");
  });

  it("normalizes 6-digit hex", () => {
    expect(normalizeCssHexColor("#0D1117")).toBe("#0d1117");
  });

  it("rejects non-hex colors", () => {
    expect(normalizeCssHexColor("rgb(255, 255, 255)")).toBeNull();
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

  it("expands shorthand --color-gh-bg from computed style", () => {
    document.documentElement.style.setProperty("--color-gh-bg", "#fff");
    expect(resolvePdfCaptureBackgroundColor()).toBe("#ffffff");
  });
});

describe("canvasToJpegDataUrl", () => {
  it("rejects blank canvases that encode as data:,", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 10;
    canvas.height = 10;
    canvas.toDataURL = () => "data:,";
    expect(() => canvasToJpegDataUrl(canvas)).toThrow(/blank image/i);
  });
});

describe("planContentPages", () => {
  it("keeps short articles on one page", () => {
    const pages = planContentPages(2000, 900);
    expect(pages).toHaveLength(1);
    expect(pages[0].topPx).toBe(0);
    expect(pages[0].heightPx).toBe(2000);
    expect(pages[0].pageHeightMm).toBeLessThanOrEqual(PDF_SAFE_PAGE_HEIGHT_MM);
  });

  it("splits articles that would exceed the PDF page-size cap", () => {
    // ~51k CSS px at ~930 width previously produced a ~10k mm page, clamped
    // to 14400pt and truncated in Preview.
    const pages = planContentPages(51555, 930);
    expect(pages.length).toBeGreaterThan(1);
    let covered = 0;
    for (const page of pages) {
      expect(page.pageHeightMm).toBeLessThanOrEqual(PDF_SAFE_PAGE_HEIGHT_MM + 1e-6);
      expect(page.pageHeightMm).toBeLessThanOrEqual(PDF_MAX_PAGE_HEIGHT_MM);
      expect(page.topPx).toBeCloseTo(covered, 5);
      covered += page.heightPx;
    }
    expect(covered).toBeCloseTo(51555, 5);
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
      expect(edgePx).toBeLessThanOrEqual(8192);
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
        expect(edgePx).toBeLessThanOrEqual(8192);
        expect(areaPx).toBeLessThanOrEqual(64 * 1024 * 1024);
      }
      const covered = plan.slices.reduce((sum, s) => sum + s.heightPx, 0);
      expect(covered).toBe(19107);
    }
  });

  it("uses fewer 1x strips on very tall pages so export stays fast", () => {
    const plan = planCapture(930, 78593, 2);
    expect(plan.ratio).toBe(1);
    expect(plan.slices.length).toBeGreaterThan(1);
    expect(plan.slices.length).toBeLessThanOrEqual(6);
    for (const slice of plan.slices) {
      expect(slice.heightPx * plan.ratio).toBeLessThanOrEqual(16384);
    }
    const covered = plan.slices.reduce((sum, s) => sum + s.heightPx, 0);
    expect(covered).toBe(78593);
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
