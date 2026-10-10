import { describe, expect, it, afterEach } from "vitest";
import {
  countPendingDiagramRenders,
  resolveCapturePixelRatio,
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

describe("resolveCapturePixelRatio", () => {
  it("follows the display on hi-dpi screens for short pages", () => {
    expect(resolveCapturePixelRatio(1120, 864, 2)).toBe(4);
  });

  it("keeps the 2x floor on low-dpi screens", () => {
    expect(resolveCapturePixelRatio(1120, 864, 1)).toBe(2);
  });

  it("caps at 4x regardless of device pixel ratio", () => {
    expect(resolveCapturePixelRatio(1120, 864, 3)).toBe(4);
  });

  it("respects the canvas ceiling for tall articles", () => {
    // 16384 / 8000 → 2x is the largest scale that still fits the canvas
    expect(resolveCapturePixelRatio(1120, 8000, 2)).toBe(2);
  });

  it("drops to 1x rather than blowing past the canvas ceiling", () => {
    expect(resolveCapturePixelRatio(1120, 20000, 2)).toBe(1);
  });

  it("never returns less than 1x", () => {
    expect(resolveCapturePixelRatio(1120, 0, 2)).toBeGreaterThan(0);
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
