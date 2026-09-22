import { toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import { groupToPath, parseGroupFromPath } from "./groups";
import { resolveLink } from "./resolve";

const PDF_MARGIN_MM = 15;
const PDF_PAGE_WIDTH_MM = 210;

interface CapturedLinkRect {
  url?: string;
  targetSourcePath?: string;
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
}

interface CapturedHeading {
  level: number;
  title: string;
  topPx: number;
}

export interface PdfCaptureOptions {
  sourceFileId?: string;
  sourceGroup?: string;
  sourceFilePath?: string;
}

export interface PdfArticleSnapshot {
  fileName: string;
  sourceFilePath?: string;
  imageDataUrl: string;
  imageWidthPx: number;
  imageHeightPx: number;
  articleWidthPx: number;
  articleHeightPx: number;
  backgroundColor: string;
  links: CapturedLinkRect[];
  headings: CapturedHeading[];
}

/** Match capture canvas / PDF page to the active app theme. */
export function resolvePdfCaptureBackgroundColor(doc: Document = document): string {
  try {
    const fromCss = doc.defaultView
      ?.getComputedStyle(doc.documentElement)
      .getPropertyValue("--color-gh-bg")
      .trim();
    if (fromCss) return fromCss;
  } catch {
    // jsdom / missing stylesheets
  }
  return doc.documentElement.getAttribute("data-theme") === "dark" ? "#0d1117" : "#ffffff";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  const n = Number.parseInt(normalized, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function fillPdfPageBackground(pdf: jsPDF, backgroundColor: string, pageHeightMm: number): void {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return;
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  pdf.rect(0, 0, PDF_PAGE_WIDTH_MM, pageHeightMm, "F");
}

function toAbsoluteUrl(href: string): string {
  if (
    !href ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:")
  ) {
    return href;
  }
  try {
    return new URL(href, window.location.origin).href;
  } catch {
    return href;
  }
}

function extractHashFragment(href: string): string {
  const idx = href.indexOf("#");
  return idx >= 0 ? href.slice(idx) : "";
}

function stripHashAndQuery(href: string): string {
  const hashIndex = href.indexOf("#");
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  return queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
}

function normalizePath(path: string): string {
  const normalized = path.replace(/\\+/g, "/").replace(/\/+/g, "/");
  if (/^[A-Za-z]:\//.test(normalized)) {
    return normalized[0].toUpperCase() + normalized.slice(1);
  }
  return normalized;
}

function splitRootAndSegments(path: string): { root: string; segments: string[] } {
  const normalized = normalizePath(path);

  if (/^[A-Za-z]:\//.test(normalized)) {
    const root = normalized.slice(0, 3);
    const rest = normalized.slice(3);
    return { root, segments: rest.split("/").filter((segment) => segment.length > 0) };
  }

  if (normalized.startsWith("/")) {
    return {
      root: "/",
      segments: normalized
        .slice(1)
        .split("/")
        .filter((segment) => segment.length > 0),
    };
  }

  return { root: "", segments: normalized.split("/").filter((segment) => segment.length > 0) };
}

function joinRootAndSegments(root: string, segments: string[]): string {
  if (!root) {
    return segments.join("/");
  }
  return `${root}${segments.join("/")}`;
}

function resolveRelativeFilePath(
  sourceFilePath: string | undefined,
  hrefPath: string,
): string | null {
  if (!sourceFilePath) return null;

  const cleanedHrefPath = stripHashAndQuery(hrefPath).trim();
  if (!cleanedHrefPath) return null;
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(cleanedHrefPath)) return null;

  const source = splitRootAndSegments(sourceFilePath);
  if (source.segments.length === 0) return null;

  const sourceDirSegments = source.segments.slice(0, -1);
  const hrefSegments = normalizePath(cleanedHrefPath)
    .split("/")
    .filter((segment) => segment.length > 0);

  if (cleanedHrefPath.startsWith("/")) {
    if (source.root === "/") {
      return normalizePath(cleanedHrefPath);
    }
    return null;
  }

  const resolvedSegments = [...sourceDirSegments];
  for (const segment of hrefSegments) {
    if (segment === ".") continue;
    if (segment === "..") {
      if (resolvedSegments.length > 0) {
        resolvedSegments.pop();
      }
      continue;
    }
    resolvedSegments.push(segment);
  }

  return joinRootAndSegments(source.root, resolvedSegments);
}

interface ResolvedPdfLink {
  url?: string;
  targetSourcePath?: string;
}

async function resolvePdfLinkUrl(
  href: string,
  sourceFileId: string | undefined,
  sourceGroup: string | undefined,
  sourceFilePath: string | undefined,
  cache: Map<string, Promise<ResolvedPdfLink | null>>,
): Promise<ResolvedPdfLink | null> {
  if (!href) return null;

  if (href.startsWith("#")) {
    return {
      targetSourcePath: sourceFilePath,
    };
  }

  const cacheKey = `${sourceFileId ?? ""}|${sourceGroup ?? ""}|${href}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const task = (async (): Promise<ResolvedPdfLink | null> => {
    if (!sourceFileId) {
      return { url: toAbsoluteUrl(href) };
    }

    const buildRuntimeOpenUrl = (relativePath: string): string => {
      const groupName = sourceGroup ?? parseGroupFromPath(window.location.pathname);
      const params = new URLSearchParams();
      params.set("mo_from", sourceFileId);
      params.set("mo_open", relativePath);
      const hash = extractHashFragment(href);
      return toAbsoluteUrl(`${groupToPath(groupName)}?${params.toString()}${hash}`);
    };

    const resolved = resolveLink(href, sourceFileId);
    switch (resolved.type) {
      case "hash":
        return null;
      case "external":
        return { url: href };
      case "file":
        return { url: toAbsoluteUrl(resolved.rawUrl) };
      case "passthrough": {
        return { url: buildRuntimeOpenUrl(stripHashAndQuery(href)) };
      }
      case "markdown": {
        return {
          url: buildRuntimeOpenUrl(resolved.hrefPath),
          targetSourcePath: resolveRelativeFilePath(sourceFilePath, resolved.hrefPath) ?? undefined,
        };
      }
    }
  })();

  cache.set(cacheKey, task);
  return task;
}

async function waitForRenderableResources(root: HTMLElement): Promise<void> {
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const waitForMermaid = async () => {
    const timeoutMs = 8000;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const pendingCount = root.querySelectorAll("[data-mermaid-render-status='pending']").length;
      if (pendingCount === 0) {
        return;
      }
      await wait(80);
    }
  };

  const waitForImages = async () => {
    const images = [...root.querySelectorAll<HTMLImageElement>("img")];
    await Promise.all(
      images.map(async (img) => {
        const src = img.currentSrc || img.getAttribute("src") || img.src;
        if (!src) return;

        try {
          img.loading = "eager";
        } catch {
          // ignore if read-only in this environment
        }

        if (!img.complete || img.naturalWidth === 0) {
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              resolve();
            };

            img.addEventListener("load", finish, { once: true });
            img.addEventListener("error", finish, { once: true });

            if (!img.complete) {
              const preloader = new Image();
              preloader.onload = finish;
              preloader.onerror = finish;
              preloader.src = src;
            }
          });
        }

        if (typeof img.decode === "function") {
          try {
            await img.decode();
          } catch {
            // ignore decode failures
          }
        }
      }),
    );
  };

  const waitForLayoutStable = async () => {
    const timeoutMs = 3000;
    const stableFramesTarget = 4;
    let stableFrames = 0;
    let prevHeight = root.scrollHeight;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      await wait(80);
      const currentHeight = root.scrollHeight;
      if (Math.abs(currentHeight - prevHeight) <= 1) {
        stableFrames += 1;
        if (stableFrames >= stableFramesTarget) {
          return;
        }
      } else {
        stableFrames = 0;
        prevHeight = currentHeight;
      }
    }
  };

  await waitForMermaid();

  await waitForImages();

  if (document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font loading errors
    }
  }

  await waitForLayoutStable();
}

function patchOutlineRenderItems(pdf: jsPDF): void {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const outline = pdf.outline as any;
  outline.renderItems = function (this: any, node: any) {
    const getVCS = this.ctx.pdf.internal.getVerticalCoordinateString;
    const getCS = this.ctx.pdf.internal.getCoordinateString;
    for (let i = 0; i < node.children.length; i++) {
      const item = node.children[i];
      this.objStart(item);
      this.line("/Title " + this.makeString(item.title));
      this.line("/Parent " + this.makeRef(node));
      if (i > 0) this.line("/Prev " + this.makeRef(node.children[i - 1]));
      if (i < node.children.length - 1) this.line("/Next " + this.makeRef(node.children[i + 1]));
      if (item.children.length > 0) {
        this.line("/First " + this.makeRef(item.children[0]));
        this.line("/Last " + this.makeRef(item.children[item.children.length - 1]));
      }
      const count = this.count_r({ count: 0 }, item);
      if (count > 0) this.line("/Count " + count);
      if (item.options?.pageNumber) {
        const info = this.ctx.pdf.internal.getPageInfo(item.options.pageNumber);
        let yPt;
        if (item.options?.destY != null) {
          if (typeof item.options.pageHeight === "number") {
            const yFromBottom = Math.max(0, item.options.pageHeight - item.options.destY);
            yPt = getCS(yFromBottom);
          } else {
            yPt = getVCS(item.options.destY);
          }
        } else if (typeof item.options.pageHeight === "number") {
          yPt = getCS(item.options.pageHeight);
        } else {
          yPt = getVCS(0);
        }
        this.line("/Dest [" + info.objId + " 0 R /XYZ 0 " + yPt + " 0]");
      }
      this.objEnd();
    }
    for (let z = 0; z < node.children.length; z++) {
      this.renderItems(node.children[z]);
    }
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

function buildSnapshotHeadings(article: HTMLElement, articleRect: DOMRect): CapturedHeading[] {
  const headings: CapturedHeading[] = [];
  const headingEls = article.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
  for (const heading of headingEls) {
    const level = parseInt(heading.tagName[1], 10);
    const title = heading.textContent?.trim();
    if (!title) continue;
    const headingRect = heading.getBoundingClientRect();
    headings.push({
      level,
      title,
      topPx: headingRect.top - articleRect.top,
    });
  }
  return headings;
}

async function buildSnapshotLinks(
  article: HTMLElement,
  articleRect: DOMRect,
  sourceFileId: string | undefined,
  sourceGroup: string | undefined,
  sourceFilePath: string | undefined,
): Promise<CapturedLinkRect[]> {
  const links: CapturedLinkRect[] = [];
  const linkCache = new Map<string, Promise<ResolvedPdfLink | null>>();
  const linkEls = article.querySelectorAll<HTMLAnchorElement>("a[href]");
  for (const a of linkEls) {
    const href = a.getAttribute("href");
    if (!href) continue;
    const resolvedLink = await resolvePdfLinkUrl(
      href,
      sourceFileId,
      sourceGroup,
      sourceFilePath,
      linkCache,
    );
    if (!resolvedLink) continue;
    const rects = a.getClientRects();
    for (const rect of rects) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      links.push({
        url: resolvedLink.url,
        targetSourcePath: resolvedLink.targetSourcePath,
        xPx: rect.left - articleRect.left,
        yPx: rect.top - articleRect.top,
        widthPx: rect.width,
        heightPx: rect.height,
      });
    }
  }
  return links;
}

async function captureArticleSnapshot(
  article: HTMLElement,
  fileName: string,
  options: PdfCaptureOptions = {},
): Promise<PdfArticleSnapshot> {
  await waitForRenderableResources(article);

  const articleRect = article.getBoundingClientRect();
  const fixedWidthPx = Math.max(1, Math.round(articleRect.width));
  const sourceFileId = options.sourceFileId ?? article.dataset.fileId;
  const sourceGroup = options.sourceGroup ?? parseGroupFromPath(window.location.pathname);
  const sourceFilePath = options.sourceFilePath;

  const backgroundColor = resolvePdfCaptureBackgroundColor();
  const imageDataUrl = await toJpeg(article, {
    quality: 0.92,
    pixelRatio: 2,
    backgroundColor,
    style: {
      width: `${fixedWidthPx}px`,
      minWidth: `${fixedWidthPx}px`,
      maxWidth: `${fixedWidthPx}px`,
      margin: "0",
      overflow: "visible",
    },
  });

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load captured image"));
    img.src = imageDataUrl;
  });

  return {
    fileName,
    sourceFilePath,
    imageDataUrl,
    imageWidthPx: img.width,
    imageHeightPx: img.height,
    articleWidthPx: articleRect.width,
    articleHeightPx: articleRect.height,
    backgroundColor,
    links: await buildSnapshotLinks(
      article,
      articleRect,
      sourceFileId,
      sourceGroup,
      sourceFilePath,
    ),
    headings: buildSnapshotHeadings(article, articleRect),
  };
}

function getPageMetrics(snapshot: PdfArticleSnapshot): {
  contentWidthMm: number;
  contentHeightMm: number;
  pageHeightMm: number;
  scaleX: number;
  scaleY: number;
} {
  const contentWidthMm = PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2;
  const contentHeightMm = (snapshot.imageHeightPx * contentWidthMm) / snapshot.imageWidthPx;
  const pageHeightMm = contentHeightMm + PDF_MARGIN_MM * 2;

  const safeArticleWidthPx = snapshot.articleWidthPx || 1;
  const safeArticleHeightPx = snapshot.articleHeightPx || 1;

  return {
    contentWidthMm,
    contentHeightMm,
    pageHeightMm,
    scaleX: contentWidthMm / safeArticleWidthPx,
    scaleY: contentHeightMm / safeArticleHeightPx,
  };
}

function drawSnapshotOnCurrentPage(
  pdf: jsPDF,
  snapshot: PdfArticleSnapshot,
  pageBySourcePath: Map<string, number>,
): { scaleX: number; scaleY: number } {
  const { contentWidthMm, contentHeightMm, pageHeightMm, scaleX, scaleY } =
    getPageMetrics(snapshot);

  fillPdfPageBackground(pdf, snapshot.backgroundColor, pageHeightMm);
  pdf.addImage(
    snapshot.imageDataUrl,
    "JPEG",
    PDF_MARGIN_MM,
    PDF_MARGIN_MM,
    contentWidthMm,
    contentHeightMm,
  );

  for (const link of snapshot.links) {
    const x = PDF_MARGIN_MM + link.xPx * scaleX;
    const y = PDF_MARGIN_MM + link.yPx * scaleY;
    const w = link.widthPx * scaleX;
    const h = link.heightPx * scaleY;
    if (w > 0 && h > 0) {
      const targetPage = link.targetSourcePath
        ? pageBySourcePath.get(normalizePath(link.targetSourcePath))
        : undefined;

      if (targetPage != null) {
        try {
          pdf.link(x, y, w, h, {
            pageNumber: targetPage,
            magFactor: "Fit",
          });
        } catch {
          // ignore invalid link target options and keep generating PDF
        }
        continue;
      }

      if (link.url) {
        pdf.link(x, y, w, h, { url: link.url });
      }
    }
  }

  return { scaleX, scaleY };
}

function stripPdfLikeExtension(fileName: string): string {
  return fileName.replace(/\.(md|mdx|pdf)$/i, "");
}

function addHeadingsToOutline(
  pdf: jsPDF,
  headings: CapturedHeading[],
  pageNumber: number,
  pageHeightMm: number,
  scaleY: number,
  rootParent: unknown,
): void {
  const stack: { level: number; item: unknown }[] = [];

  for (const heading of headings) {
    const destY = PDF_MARGIN_MM + heading.topPx * scaleY;

    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1].item : rootParent;
    const item = pdf.outline.add(parent as never, heading.title, {
      pageNumber,
      destY,
      pageHeight: pageHeightMm,
    } as never);
    stack.push({ level: heading.level, item });
  }
}

function createPdfDocument(initialSnapshot: PdfArticleSnapshot, filename: string): jsPDF {
  const { pageHeightMm } = getPageMetrics(initialSnapshot);
  const pdf = new jsPDF({
    unit: "mm",
    format: [PDF_PAGE_WIDTH_MM, pageHeightMm],
  });

  patchOutlineRenderItems(pdf);

  const docTitle = filename.replace(/\.pdf$/i, "");
  pdf.setProperties({ title: docTitle });

  return pdf;
}

async function exportAsSinglePagePdf(
  article: HTMLElement,
  filename: string,
  options: PdfCaptureOptions = {},
): Promise<void> {
  const snapshot = await captureArticleSnapshot(article, filename, options);
  const pdf = createPdfDocument(snapshot, filename);
  const pageBySourcePath = new Map<string, number>();
  if (snapshot.sourceFilePath) {
    pageBySourcePath.set(normalizePath(snapshot.sourceFilePath), 1);
  }

  const { scaleY } = drawSnapshotOnCurrentPage(pdf, snapshot, pageBySourcePath);
  const { pageHeightMm } = getPageMetrics(snapshot);
  addHeadingsToOutline(pdf, snapshot.headings, 1, pageHeightMm, scaleY, null);

  pdf.save(filename);
}

export async function captureArticleForMergedPdf(
  article: HTMLElement,
  fileName: string,
  options: PdfCaptureOptions = {},
): Promise<PdfArticleSnapshot> {
  return captureArticleSnapshot(article, fileName, options);
}

export async function exportMergedPdfFromSnapshots(
  snapshots: PdfArticleSnapshot[],
  outputFileName: string,
): Promise<void> {
  if (snapshots.length === 0) {
    throw new Error("No snapshots to export");
  }

  const filename = toPdfFilename(outputFileName);
  const pdf = createPdfDocument(snapshots[0], filename);
  const pageBySourcePath = new Map<string, number>();

  for (let i = 0; i < snapshots.length; i++) {
    const sourcePath = snapshots[i].sourceFilePath;
    if (sourcePath) {
      pageBySourcePath.set(normalizePath(sourcePath), i + 1);
    }
  }

  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const pageNumber = i + 1;
    const { pageHeightMm } = getPageMetrics(snapshot);

    if (i > 0) {
      pdf.addPage([PDF_PAGE_WIDTH_MM, pageHeightMm]);
      pdf.setPage(pageNumber);
    }

    const { scaleY } = drawSnapshotOnCurrentPage(pdf, snapshot, pageBySourcePath);

    const fileOutlineTitle = stripPdfLikeExtension(snapshot.fileName) || `Document ${pageNumber}`;
    const fileRootItem = pdf.outline.add(null, fileOutlineTitle, {
      pageNumber,
      destY: PDF_MARGIN_MM,
      pageHeight: pageHeightMm,
    } as never);

    addHeadingsToOutline(pdf, snapshot.headings, pageNumber, pageHeightMm, scaleY, fileRootItem);
  }

  pdf.save(filename);
}

function collectPrintableStyles(): string {
  const styles: string[] = [];
  const styleNodes = document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
    "link[rel='stylesheet'], style",
  );

  styleNodes.forEach((node) => {
    if (node.tagName.toLowerCase() === "link") {
      const link = node as HTMLLinkElement;
      if (link.href) styles.push(`<link rel="stylesheet" href="${link.href}">`);
      return;
    }
    const style = node as HTMLStyleElement;
    styles.push(`<style>${style.textContent ?? ""}</style>`);
  });

  return styles.join("\n");
}

function openPrintFallback(article: HTMLElement, filename: string): void {
  const clone = article.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src");
    if (src) img.setAttribute("src", toAbsoluteUrl(src));
  });
  clone.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && !href.startsWith("#")) a.setAttribute("href", toAbsoluteUrl(href));
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("无法打开打印窗口，请检查浏览器是否拦截了弹窗");
    return;
  }

  const printableStyles = collectPrintableStyles();
  const currentTheme = document.documentElement.getAttribute("data-theme") ?? "light";
  const htmlClass = document.documentElement.className;

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html data-theme="${currentTheme}" class="${htmlClass}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${filename}</title>
    ${printableStyles}
    <style>
      @page { size: A4; margin: 15mm; }
      html, body {
        margin: 0;
        padding: 0;
        background: var(--color-gh-bg, ${currentTheme === "dark" ? "#0d1117" : "#ffffff"});
        color: var(--color-gh-text, ${currentTheme === "dark" ? "#e6edf3" : "#1f2328"});
      }
      .markdown-body { max-width: none !important; margin: 0 !important; }
    </style>
  </head>
  <body>
    ${clone.outerHTML}
  </body>
</html>`);
  printWindow.document.close();

  printWindow.focus();
  printWindow.print();
}

export function toPdfFilename(fileName: string): string {
  if (!fileName) return "document.pdf";
  if (fileName.toLowerCase().endsWith(".pdf")) return fileName;
  return `${fileName.replace(/\.(md|mdx)$/i, "")}.pdf`;
}

export async function exportArticleAsPdf(
  article: HTMLElement,
  fileName: string,
  options: PdfCaptureOptions = {},
): Promise<void> {
  const filename = toPdfFilename(fileName);
  try {
    await exportAsSinglePagePdf(article, filename, options);
  } catch {
    openPrintFallback(article, filename);
  }
}

export function toSlidesDeckPdfFilename(fileName: string): string {
  const base = toPdfFilename(fileName).replace(/\.pdf$/i, "");
  if (/[-_]deck$/i.test(base)) return `${base}.pdf`;
  return `${base}-deck.pdf`;
}

export interface SlidesDeckExportController {
  slideCount: number;
  getSlideIndex: () => number;
  goToSlide: (index: number) => void;
  getSlidePage: () => HTMLElement | null;
}

async function waitForSlidePageElement(
  getSlidePage: () => HTMLElement | null,
  index: number,
): Promise<HTMLElement> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const el = getSlidePage();
    if (el && el.getAttribute("data-slide-index") === String(index)) {
      return el;
    }
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  throw new Error(`Timed out waiting for slide ${index + 1}`);
}

/**
 * Capture each Slides page (16:9 surface only) into a multi-page PDF.
 * Restores the original slide index when finished (including on failure).
 */
export async function exportSlidesDeckAsPdf(
  controller: SlidesDeckExportController,
  fileName: string,
  options: PdfCaptureOptions = {},
): Promise<void> {
  const count = Math.max(0, controller.slideCount);
  if (count === 0) {
    throw new Error("No slides to export");
  }

  const filename = toSlidesDeckPdfFilename(fileName);
  const previousIndex = controller.getSlideIndex();
  const snapshots: PdfArticleSnapshot[] = [];

  try {
    for (let i = 0; i < count; i++) {
      controller.goToSlide(i);
      const page = await waitForSlidePageElement(controller.getSlidePage, i);
      const snapshot = await captureArticleForMergedPdf(page, `Slide ${i + 1}`, options);
      snapshots.push(snapshot);
    }
    await exportMergedPdfFromSnapshots(snapshots, filename);
  } finally {
    controller.goToSlide(previousIndex);
  }
}
