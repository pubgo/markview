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
 * PDF / common viewers hard-cap a page edge at 14400pt (~5080mm). A taller
 * single page is silently clipped (black/empty tail in Preview etc.), so long
 * articles must split across pages under this ceiling.
 */
const PDF_MAX_PAGE_HEIGHT_PT = 14400;
export const PDF_MAX_PAGE_HEIGHT_MM = (PDF_MAX_PAGE_HEIGHT_PT * 25.4) / 72;
/** Keep a small margin under the hard cap for rounding / image overflow. */
export const PDF_SAFE_PAGE_HEIGHT_MM = 5000;

/**
 * Per-slice capture budgets for html-to-image. Very tall articles cannot be
 * rasterized as one canvas (edge/area limits → hang or blank → print
 * fallback), so we capture vertical strips whose device size stays inside
 * these ceilings. Taller docs use fewer, lower-ratio strips so export time
 * stays acceptable.
 */
const CAPTURE_AREA_LIMIT_PX = 64 * 1024 * 1024;
const CAPTURE_MIN_PIXEL_RATIO = 2;
const CAPTURE_MAX_PIXEL_RATIO = 4;
/** Default strip edge; html-to-image's own auto-scale ceiling is 16384. */
const TILE_MAX_EDGE_PX = 8192;
const TILE_MAX_EDGE_TALL_PX = 16384;
/** Above this CSS height, prefer fewer 1x strips over many hi-dpi ones. */
const TALL_ARTICLE_CSS_PX = 25000;

export interface CapturePlan {
  /** Device-pixel ratio used for each strip capture. */
  ratio: number;
  /** Vertical strips covering [0, heightPx]; each is captured separately. */
  slices: Array<{ topPx: number; heightPx: number }>;
}

/**
 * Plan strip captures: short pages stay sharp (up to 4x); very tall pages use
 * 1x and longer strips so we do far fewer html-to-image passes.
 */
export function planCapture(
  widthPx: number,
  heightPx: number,
  devicePixelRatio = typeof window !== "undefined" ? window.devicePixelRatio : 1,
): CapturePlan {
  const safeWidth = Math.max(1, widthPx);
  const safeHeight = Math.max(1, heightPx);
  const veryTall = safeHeight >= TALL_ARTICLE_CSS_PX;
  const tileEdge = veryTall ? TILE_MAX_EDGE_TALL_PX : TILE_MAX_EDGE_PX;
  const preferred = veryTall
    ? 1
    : Math.max(CAPTURE_MIN_PIXEL_RATIO, Math.ceil((devicePixelRatio || 1) * 2));
  const maxWidthRatio = Math.floor(tileEdge / safeWidth);
  // Per-strip area ≈ width * tileEdge * ratio
  const maxAreaRatio = Math.floor(CAPTURE_AREA_LIMIT_PX / (safeWidth * tileEdge));
  const ratio = Math.max(
    1,
    Math.min(
      veryTall ? 1 : CAPTURE_MAX_PIXEL_RATIO,
      preferred,
      maxWidthRatio,
      Math.max(1, maxAreaRatio),
    ),
  );

  const sliceHeight = Math.min(safeHeight, Math.floor(tileEdge / ratio));
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

/** Expand #rgb / accept #rrggbb; returns null for non-hex colors. */
export function normalizeCssHexColor(value: string): string | null {
  const trimmed = value.trim();
  const short = /^#([0-9a-fA-F]{3})$/.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = /^#([0-9a-fA-F]{6})$/.exec(trimmed);
  if (full) return `#${full[1]}`.toLowerCase();
  return null;
}

/** Match capture canvas / PDF page to the active app theme. */
export function resolvePdfCaptureBackgroundColor(doc: Document = document): string {
  const darkFallback = "#0d1117";
  const lightFallback = "#ffffff";
  try {
    const fromCss = doc.defaultView
      ?.getComputedStyle(doc.documentElement)
      .getPropertyValue("--color-gh-bg")
      .trim();
    if (fromCss) {
      return (
        normalizeCssHexColor(fromCss) ??
        (doc.documentElement.getAttribute("data-theme") === "dark" ? darkFallback : lightFallback)
      );
    }
  } catch {
    // jsdom / missing stylesheets
  }
  return doc.documentElement.getAttribute("data-theme") === "dark" ? darkFallback : lightFallback;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeCssHexColor(hex)?.replace(/^#/, "");
  if (!normalized) return null;
  const n = Number.parseInt(normalized, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Reject blank canvases (oversized foreignObject captures yield data:,). */
export function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = 0.95): string {
  const dataUrl = canvas.toDataURL("image/jpeg", quality) ?? "";
  if (!dataUrl.startsWith("data:image/jpeg") || dataUrl.length < 512) {
    throw new Error("PDF capture produced a blank image");
  }
  return dataUrl;
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

function isUsableCaptureCanvas(canvas: HTMLCanvasElement): boolean {
  if (canvas.width < 1 || canvas.height < 1) return false;
  try {
    const probe = canvas.toDataURL("image/jpeg", 0.5) ?? "";
    return probe.startsWith("data:image/jpeg") && probe.length >= 512;
  } catch {
    return false;
  }
}

interface PdfDomBackup {
  el: HTMLElement;
  kind: "spacer" | "hide";
  html: string;
  height: string;
  minHeight: string;
  overflow: string;
  opacity: string;
  display: string;
}

/**
 * Temporarily strip heavy off-strip content from the live article so each
 * html-to-image call serializes a small DOM. Spacers keep Y layout for the
 * visible strip; callers must restore via the returned backups.
 */
function shrinkArticleDomToSlice(
  article: HTMLElement,
  slice: { topPx: number; heightPx: number },
): PdfDomBackup[] {
  const backups: PdfDomBackup[] = [];
  const touched = new Set<HTMLElement>();
  const articleRect = article.getBoundingClientRect();
  const sliceTop = slice.topPx;
  const sliceBottom = slice.topPx + slice.heightPx;
  const slackPx = 64;

  // Prefer direct children: one spacer/hide covers nested mermaid/pre trees.
  const candidates = article.querySelectorAll<HTMLElement>(":scope > *");

  candidates.forEach((el) => {
    if (touched.has(el)) return;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0 && rect.width <= 0) return;
    const top = rect.top - articleRect.top;
    const bottom = rect.bottom - articleRect.top;

    if (bottom < sliceTop - slackPx) {
      touched.add(el);
      backups.push({
        el,
        kind: "spacer",
        html: el.innerHTML,
        height: el.style.height,
        minHeight: el.style.minHeight,
        overflow: el.style.overflow,
        opacity: el.style.opacity,
        display: el.style.display,
      });
      el.style.height = `${Math.max(1, Math.round(rect.height))}px`;
      el.style.minHeight = el.style.height;
      el.style.overflow = "hidden";
      el.style.opacity = "0";
      el.innerHTML = "";
      return;
    }

    if (top > sliceBottom + slackPx) {
      touched.add(el);
      backups.push({
        el,
        kind: "hide",
        html: el.innerHTML,
        height: el.style.height,
        minHeight: el.style.minHeight,
        overflow: el.style.overflow,
        opacity: el.style.opacity,
        display: el.style.display,
      });
      el.style.display = "none";
    }
  });

  return backups;
}

function restoreArticleDomFromSlice(backups: PdfDomBackup[]): void {
  for (let i = backups.length - 1; i >= 0; i--) {
    const b = backups[i];
    b.el.style.height = b.height;
    b.el.style.minHeight = b.minHeight;
    b.el.style.overflow = b.overflow;
    b.el.style.opacity = b.opacity;
    b.el.style.display = b.display;
    if (b.kind === "spacer") {
      b.el.innerHTML = b.html;
    }
  }
}

async function captureArticleSnapshot(
  article: HTMLElement,
  fileName: string,
  options: PdfCaptureOptions = {},
): Promise<PdfArticleSnapshot> {
  await waitForRenderableResources(article);

  const articleRect = article.getBoundingClientRect();
  const fixedWidthPx = Math.max(1, Math.round(articleRect.width));
  const articleHeightPx = Math.max(1, article.scrollHeight || Math.round(articleRect.height));
  const sourceFileId = options.sourceFileId ?? article.dataset.fileId;
  const sourceGroup = options.sourceGroup ?? parseGroupFromPath(window.location.pathname);
  const sourceFilePath = options.sourceFilePath;
  const backgroundColor = resolvePdfCaptureBackgroundColor();

  const plan = planCapture(fixedWidthPx, articleHeightPx);
  const { toCanvas, getFontEmbedCSS } = await import("html-to-image");
  // Font embedding re-serializes every stylesheet into each strip SVG and
  // dominates runtime on long docs; keep it for short/medium pages only.
  const fontEmbedCSS =
    plan.slices.length <= 3
      ? await getFontEmbedCSS(article).catch(() => undefined)
      : undefined;
  const jpegQuality = plan.slices.length > 8 ? 0.85 : 0.95;

  const parent = article.parentElement;
  if (!parent) {
    throw new Error("PDF capture target has no parent element");
  }
  const nextSibling = article.nextSibling;
  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${fixedWidthPx}px`,
    "overflow:hidden",
    `background:${backgroundColor}`,
    "z-index:2147483646",
  ].join(";");

  const prevMarginTop = article.style.marginTop;
  const prevWidth = article.style.width;
  const prevMinWidth = article.style.minWidth;
  const prevMaxWidth = article.style.maxWidth;

  article.style.width = `${fixedWidthPx}px`;
  article.style.minWidth = `${fixedWidthPx}px`;
  article.style.maxWidth = `${fixedWidthPx}px`;
  host.appendChild(article);
  document.body.appendChild(host);

  const tiles: PdfSnapshotTile[] = [];
  try {
    for (const slice of plan.slices) {
      host.style.height = `${slice.heightPx}px`;
      article.style.marginTop = `-${slice.topPx}px`;
      const backups = shrinkArticleDomToSlice(article, slice);
      try {
        const candidate = await toCanvas(host, {
          pixelRatio: plan.ratio,
          skipAutoScale: true,
          backgroundColor,
          fontEmbedCSS,
          width: fixedWidthPx,
          height: slice.heightPx,
          style: { margin: "0", overflow: "hidden" },
        });
        if (!isUsableCaptureCanvas(candidate)) {
          throw new Error("PDF capture produced a blank image");
        }
        tiles.push({
          dataUrl: canvasToJpegDataUrl(candidate, jpegQuality),
          cssTopPx: slice.topPx,
          cssHeightPx: slice.heightPx,
        });
      } finally {
        restoreArticleDomFromSlice(backups);
      }
    }
  } finally {
    article.style.marginTop = prevMarginTop;
    article.style.width = prevWidth;
    article.style.minWidth = prevMinWidth;
    article.style.maxWidth = prevMaxWidth;
    if (nextSibling) parent.insertBefore(article, nextSibling);
    else parent.appendChild(article);
    host.remove();
  }

  const restoredRect = article.getBoundingClientRect();
  return {
    fileName,
    sourceFilePath,
    tiles,
    articleWidthPx: fixedWidthPx,
    articleHeightPx,
    backgroundColor,
    links: await buildSnapshotLinks(
      article,
      restoredRect,
      sourceFileId,
      sourceGroup,
      sourceFilePath,
    ),
    headings: buildSnapshotHeadings(article, restoredRect),
  };
}

export interface PdfContentPagePlan {
  /** CSS-pixel Y offset of this page within the article. */
  topPx: number;
  /** CSS-pixel height covered by this page. */
  heightPx: number;
  /** Full PDF page height including margins. */
  pageHeightMm: number;
}

function getContentWidthMm(): number {
  return PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2;
}

export function getPdfContentScale(articleWidthPx: number): number {
  return getContentWidthMm() / Math.max(1, articleWidthPx);
}

/**
 * Split article height into PDF pages that stay under the viewer page-size
 * cap. Short docs remain a single page; long docs paginate without clipping.
 */
export function planContentPages(
  articleHeightPx: number,
  articleWidthPx: number,
  maxPageHeightMm = PDF_SAFE_PAGE_HEIGHT_MM,
): PdfContentPagePlan[] {
  const scale = getPdfContentScale(articleWidthPx);
  const maxContentMm = Math.max(1, maxPageHeightMm - PDF_MARGIN_MM * 2);
  const maxContentPx = maxContentMm / scale;
  const totalPx = Math.max(1, articleHeightPx);

  const pages: PdfContentPagePlan[] = [];
  let top = 0;
  while (top < totalPx - 1e-6) {
    const heightPx = Math.min(maxContentPx, totalPx - top);
    pages.push({
      topPx: top,
      heightPx,
      pageHeightMm: heightPx * scale + PDF_MARGIN_MM * 2,
    });
    top += heightPx;
  }
  return pages.length > 0
    ? pages
    : [{ topPx: 0, heightPx: totalPx, pageHeightMm: totalPx * scale + PDF_MARGIN_MM * 2 }];
}

function getPageMetrics(snapshot: PdfArticleSnapshot): {
  contentWidthMm: number;
  contentHeightMm: number;
  pageHeightMm: number;
  scaleX: number;
  scaleY: number;
} {
  const contentWidthMm = getContentWidthMm();
  const safeArticleWidthPx = snapshot.articleWidthPx || 1;
  const safeArticleHeightPx = snapshot.articleHeightPx || 1;
  const scale = contentWidthMm / safeArticleWidthPx;
  const contentHeightMm = safeArticleHeightPx * scale;
  const pageHeightMm = contentHeightMm + PDF_MARGIN_MM * 2;

  return {
    contentWidthMm,
    contentHeightMm,
    pageHeightMm,
    scaleX: scale,
    scaleY: scale,
  };
}

function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a1 > b0 && a0 < b1;
}

/**
 * Draw one article snapshot onto one or more PDF pages. Returns the first
 * page index used (1-based) accounting is done by the caller via startPage.
 */
function drawSnapshotAcrossPages(
  pdf: jsPDF,
  snapshot: PdfArticleSnapshot,
  pageBySourcePath: Map<string, number>,
  startPage: number,
  options: { addFirstPage?: boolean; imageAliasPrefix?: string } = {},
): { scaleX: number; scaleY: number; pageCount: number; pages: PdfContentPagePlan[] } {
  const { contentWidthMm, scaleX, scaleY } = getPageMetrics(snapshot);
  const pages = planContentPages(snapshot.articleHeightPx, snapshot.articleWidthPx);
  const aliasPrefix = options.imageAliasPrefix ?? "article-tile";
  let tileIndex = 0;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageNumber = startPage + i;
    if (i === 0) {
      if (options.addFirstPage) {
        pdf.addPage([PDF_PAGE_WIDTH_MM, page.pageHeightMm]);
      }
      // First page of a new document is created by the caller with this size.
    } else {
      pdf.addPage([PDF_PAGE_WIDTH_MM, page.pageHeightMm]);
    }
    pdf.setPage(pageNumber);

    fillPdfPageBackground(pdf, snapshot.backgroundColor, page.pageHeightMm);

    const pageTopPx = page.topPx;
    const pageBottomPx = page.topPx + page.heightPx;

    for (const tile of snapshot.tiles) {
      const tileTop = tile.cssTopPx;
      const tileBottom = tile.cssTopPx + tile.cssHeightPx;
      if (!rangesOverlap(tileTop, tileBottom, pageTopPx, pageBottomPx)) continue;

      // Overflow past the MediaBox is clipped per page; draw on every
      // overlapping page with a page-local Y so straddling tiles stay intact.
      const y = PDF_MARGIN_MM + (tile.cssTopPx - pageTopPx) * scaleY;
      pdf.addImage(
        tile.dataUrl,
        "JPEG",
        PDF_MARGIN_MM,
        y,
        contentWidthMm,
        tile.cssHeightPx * scaleY,
        `${aliasPrefix}-${tileIndex++}-p${pageNumber}`,
      );
    }

    for (const link of snapshot.links) {
      const linkTop = link.yPx;
      const linkBottom = link.yPx + link.heightPx;
      if (!rangesOverlap(linkTop, linkBottom, pageTopPx, pageBottomPx)) continue;

      const x = PDF_MARGIN_MM + link.xPx * scaleX;
      const y = PDF_MARGIN_MM + (link.yPx - pageTopPx) * scaleY;
      const w = link.widthPx * scaleX;
      const h = link.heightPx * scaleY;
      if (w <= 0 || h <= 0) continue;

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

  return { scaleX, scaleY, pageCount: pages.length, pages };
}

function addHeadingsToOutlineAcrossPages(
  pdf: jsPDF,
  headings: CapturedHeading[],
  pages: PdfContentPagePlan[],
  startPage: number,
  scaleY: number,
  rootParent: unknown,
): void {
  const stack: { level: number; item: unknown }[] = [];

  for (const heading of headings) {
    let pageIndex = 0;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (heading.topPx >= page.topPx && heading.topPx < page.topPx + page.heightPx) {
        pageIndex = i;
        break;
      }
      if (i === pages.length - 1) pageIndex = i;
    }
    const page = pages[pageIndex];
    const pageNumber = startPage + pageIndex;
    const destY = PDF_MARGIN_MM + (heading.topPx - page.topPx) * scaleY;

    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1].item : rootParent;
    const item = pdf.outline.add(parent as never, heading.title, {
      pageNumber,
      destY,
      pageHeight: page.pageHeightMm,
    } as never);
    stack.push({ level: heading.level, item });
  }
}

function stripPdfLikeExtension(fileName: string): string {
  return fileName.replace(/\.(md|mdx|pdf)$/i, "");
}

async function createPdfDocument(
  initialSnapshot: PdfArticleSnapshot,
  filename: string,
): Promise<jsPDF> {
  const JsPdfCtor = await loadJsPdf();
  const firstPage = planContentPages(
    initialSnapshot.articleHeightPx,
    initialSnapshot.articleWidthPx,
  )[0];
  const pdf = new JsPdfCtor({
    unit: "mm",
    format: [PDF_PAGE_WIDTH_MM, firstPage.pageHeightMm],
  });

  patchOutlineRenderItems(pdf);

  const docTitle = filename.replace(/\.pdf$/i, "");
  pdf.setProperties({ title: docTitle });

  return pdf;
}

async function exportArticlePdf(
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

  const { scaleY, pages } = drawSnapshotAcrossPages(pdf, snapshot, pageBySourcePath, 1);
  addHeadingsToOutlineAcrossPages(pdf, snapshot.headings, pages, 1, scaleY, null);

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

  // First pass: assign each source file to the page where it will start.
  let nextPage = 1;
  const startPages: number[] = [];
  for (const snapshot of snapshots) {
    startPages.push(nextPage);
    if (snapshot.sourceFilePath) {
      pageBySourcePath.set(normalizePath(snapshot.sourceFilePath), nextPage);
    }
    nextPage += planContentPages(snapshot.articleHeightPx, snapshot.articleWidthPx).length;
  }

  nextPage = 1;
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const startPage = startPages[i];
    const { scaleY, pages, pageCount } = drawSnapshotAcrossPages(
      pdf,
      snapshot,
      pageBySourcePath,
      startPage,
      {
        addFirstPage: i > 0,
        imageAliasPrefix: `doc${i}-tile`,
      },
    );

    const fileOutlineTitle = stripPdfLikeExtension(snapshot.fileName) || `Document ${i + 1}`;
    const fileRootItem = pdf.outline.add(null, fileOutlineTitle, {
      pageNumber: startPage,
      destY: PDF_MARGIN_MM,
      pageHeight: pages[0].pageHeightMm,
    } as never);

    addHeadingsToOutlineAcrossPages(
      pdf,
      snapshot.headings,
      pages,
      startPage,
      scaleY,
      fileRootItem,
    );
    nextPage = startPage + pageCount;
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
    await exportArticlePdf(article, filename, options);
  } catch (error) {
    console.error("[markview] PDF export failed, falling back to print:", error);
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
