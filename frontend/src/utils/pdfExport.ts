import type jsPDF from "jspdf";
import { groupToPath, parseGroupFromPath } from "./groups";
import { resolveLink } from "./resolve";

let jsPdfCtorPromise: Promise<(typeof import("jspdf"))["default"]> | null = null;

/** Load jsPDF on demand — the PDF stack is only needed when exporting. */
function loadJsPdf(): Promise<(typeof import("jspdf"))["default"]> {
  jsPdfCtorPromise ??= import("jspdf").then((m) => m.default);
  return jsPdfCtorPromise;
}

const PDF_MARGIN_MM = 15;
const PDF_PAGE_WIDTH_MM = 210;

/**
 * Empirical canvas budgets (verified in Chromium: a 3920x62360 canvas
 * renders and round-trips at full resolution): the engine's own limits are
 * a 65535px edge and a ~268M px area, so capture ratio follows the display
 * and only slides back for extremely tall pages.
 */
const CANVAS_AREA_LIMIT_PX = 268435456; // Chromium max canvas area (16384²)
const CANVAS_EDGE_LIMIT_PX = 65535;
const CAPTURE_MIN_PIXEL_RATIO = 2;
const CAPTURE_MAX_PIXEL_RATIO = 4;
/** Tiles stay well under the lib's 16384 auto-scale edge when re-encoded. */
const TILE_MAX_EDGE_PX = 16384;

export interface CapturePlan {
  /** Device-pixel ratio used for the full-page capture. */
  ratio: number;
  /** Vertical slices covering [0, heightPx]; each is encoded separately. */
  slices: Array<{ topPx: number; heightPx: number }>;
}

/**
 * Plan a PDF capture: scale with the display (2x per device pixel, capped at
 * 4x), sliding the ratio down only when the full-page canvas would exceed
 * the engine's edge/area limits, then split the capture into vertical tiles
 * that stay well inside the lib's conservative 16384px auto-scale edge.
 * Tiling is what lets long documents keep the same sharpness as short ones
 * — a single small canvas would force them down to 1x.
 */
export function planCapture(
  widthPx: number,
  heightPx: number,
  devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio : 1,
): CapturePlan {
  const safeWidth = Math.max(1, widthPx);
  const safeHeight = Math.max(1, heightPx);
  const preferred = Math.max(CAPTURE_MIN_PIXEL_RATIO, Math.ceil((devicePixelRatio || 1) * 2));
  const maxEdgeRatio = Math.floor(CANVAS_EDGE_LIMIT_PX / safeHeight);
  const maxAreaRatio = Math.floor(Math.sqrt(CANVAS_AREA_LIMIT_PX / (safeWidth * safeHeight)));
  const ratio = Math.max(
    1,
    Math.min(CAPTURE_MAX_PIXEL_RATIO, preferred, maxEdgeRatio, maxAreaRatio),
  );

  const sliceHeight = Math.min(safeHeight, Math.floor(TILE_MAX_EDGE_PX / ratio));
  const count = Math.max(1, Math.ceil(safeHeight / sliceHeight));
  const base = Math.floor(safeHeight / count);
  const extra = safeHeight % count;

  const slices: Array<{ topPx: number; heightPx: number }> = [];
  let top = 0;
  for (let i = 0; i < count; i++) {
    const h = base + (i < extra ? 1 : 0);
    slices.push({ topPx: top, heightPx: h });
    top += h;
  }
  return { ratio, slices };
}

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

/** Pending diagram renders that PDF capture should wait on. */
export const DIAGRAM_PENDING_SELECTOR = [
  "[data-mermaid-render-status='pending']",
  "[data-plantuml-render-status='pending']",
  "[data-svgbob-render-status='pending']",
].join(", ");

export function countPendingDiagramRenders(root: ParentNode): number {
  return root.querySelectorAll(DIAGRAM_PENDING_SELECTOR).length;
}

export interface PdfSnapshotTile {
  dataUrl: string;
  /** Top offset of the slice within the article, in CSS pixels. */
  cssTopPx: number;
  /** Slice height in CSS pixels; the last slice may be shorter. */
  cssHeightPx: number;
}

export interface PdfArticleSnapshot {
  fileName: string;
  sourceFilePath?: string;
  tiles: PdfSnapshotTile[];
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

  const waitForDiagrams = async () => {
    const timeoutMs = 8000;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (countPendingDiagramRenders(root) === 0) {
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

  await waitForDiagrams();

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

  const plan = planCapture(articleRect.width, articleRect.height);
  const { toCanvas, getFontEmbedCSS } = await import("html-to-image");
  // Font embedding re-serializes every stylesheet; do it once, not per tile.
  const fontEmbedCSS = await getFontEmbedCSS(article).catch(() => undefined);
  const full = await toCanvas(article, {
    pixelRatio: plan.ratio,
    // planCapture keeps the full canvas inside verified engine limits; the
    // lib's own auto-scale would silently shrink tall captures past its
    // hardcoded 16384px edge limit.
    skipAutoScale: true,
    backgroundColor,
    fontEmbedCSS,
    style: {
      width: `${fixedWidthPx}px`,
      minWidth: `${fixedWidthPx}px`,
      maxWidth: `${fixedWidthPx}px`,
      margin: "0",
    },
  });

  // Slice the full-resolution canvas into vertical tiles (plain canvas
  // math — no foreignObject clipping, which renders blank past ~16384
  // device pixels of subtree height).
  const tiles: PdfSnapshotTile[] = [];
  for (const slice of plan.slices) {
    const devTop = Math.round(slice.topPx * plan.ratio);
    const devHeight = Math.max(1, Math.round((slice.topPx + slice.heightPx) * plan.ratio) - devTop);
    const tile = document.createElement("canvas");
    tile.width = full.width;
    tile.height = devHeight;
    const ctx = tile.getContext("2d");
    if (!ctx) {
      throw new Error("cannot acquire 2d context for PDF tile");
    }
    ctx.drawImage(full, 0, devTop, full.width, devHeight, 0, 0, full.width, devHeight);
    const dataUrl = tile.toDataURL("image/jpeg", 0.95);
    tiles.push({ dataUrl, cssTopPx: slice.topPx, cssHeightPx: slice.heightPx });
  }

  return {
    fileName,
    sourceFilePath,
    tiles,
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
  const contentHeightMm = (snapshot.articleHeightPx * contentWidthMm) / snapshot.articleWidthPx;
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
  const { contentWidthMm, pageHeightMm, scaleX, scaleY } = getPageMetrics(snapshot);

  fillPdfPageBackground(pdf, snapshot.backgroundColor, pageHeightMm);
  // Tiles are pre-clipped vertical slices of the article; stacking them at
  // their offsets rebuilds the full page at the tile resolution. The alias
  // must be unique per tile: jsPDF dedupes images by data length, so same
  // sized slices would otherwise silently reuse each other's bitmap.
  let tileIndex = 0;
  for (const tile of snapshot.tiles) {
    pdf.addImage(
      tile.dataUrl,
      "JPEG",
      PDF_MARGIN_MM,
      PDF_MARGIN_MM + tile.cssTopPx * scaleY,
      contentWidthMm,
      tile.cssHeightPx * scaleY,
      `slide-tile-${tileIndex++}`,
    );
  }

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

async function createPdfDocument(
  initialSnapshot: PdfArticleSnapshot,
  filename: string,
): Promise<jsPDF> {
  const JsPdfCtor = await loadJsPdf();
  const { pageHeightMm } = getPageMetrics(initialSnapshot);
  const pdf = new JsPdfCtor({
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
  const pdf = await createPdfDocument(snapshot, filename);
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
  const pdf = await createPdfDocument(snapshots[0], filename);
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
