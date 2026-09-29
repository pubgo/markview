import { describe, expect, it, afterEach } from "vitest";
import {
  countPendingDiagramRenders,
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
