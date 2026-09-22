/**
 * In-slide column split: a line that is only `|||` (optionally spaced)
 * divides the slide into columns. Fence bodies are not scanned.
 *
 * A leading ATX heading separated by a blank line is treated as a shared
 * title above the grid only when the first column starts with a deeper heading
 * (e.g. `##` title + `###` column heads). Equal-level heads stay in-column.
 */

const COLUMN_SEP_RE = /^\s*\|\|\|\s*$/;
const SHARED_TITLE_RE = /^(#{1,6}[ \t]+[^\n]+)\n\n+([\s\S]*)$/;
const HEADING_LEVEL_RE = /^(#{1,6})[ \t]+/;

export type SlideColumnLayout = {
  title: string | null;
  columns: string[];
};

function headingLevel(line: string): number | null {
  const match = line.trim().match(HEADING_LEVEL_RE);
  return match ? (match[1]?.length ?? null) : null;
}

export function splitSlideColumns(markdown: string): string[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const columns: string[] = [];
  let buf: string[] = [];
  let inFence = false;
  let fenceChar: "`" | "~" | "" = "";
  let fenceLen = 0;

  const flush = () => {
    const text = buf
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    columns.push(text);
    buf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    const fence = trimmed.match(/^(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1] ?? "";
      if (!inFence) {
        inFence = true;
        fenceChar = (marker[0] as "`" | "~") ?? "";
        fenceLen = marker.length;
      } else {
        const expected = fenceChar.repeat(fenceLen);
        if (trimmed.startsWith(expected)) {
          inFence = false;
          fenceChar = "";
          fenceLen = 0;
        }
      }
      buf.push(raw);
      continue;
    }

    if (!inFence && COLUMN_SEP_RE.test(line)) {
      flush();
      continue;
    }

    buf.push(raw);
  }

  flush();

  // No separators → single column (original body).
  if (columns.length <= 1) {
    return [markdown.replace(/\r\n/g, "\n").trim()];
  }

  return columns.filter((col) => col.length > 0);
}

export function parseSlideColumnLayout(markdown: string): SlideColumnLayout {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const rawColumns = splitSlideColumns(normalized);
  if (rawColumns.length <= 1) {
    return { title: null, columns: rawColumns };
  }

  const titleMatch = normalized.match(SHARED_TITLE_RE);
  if (!titleMatch) {
    return { title: null, columns: rawColumns };
  }

  const title = titleMatch[1] ?? "";
  const rest = (titleMatch[2] ?? "").trim();
  const titleLevel = headingLevel(title);
  const firstRestLine = rest.split("\n").find((line) => line.trim().length > 0) ?? "";
  const nextLevel = headingLevel(firstRestLine);
  if (titleLevel == null || nextLevel == null || nextLevel <= titleLevel) {
    return { title: null, columns: rawColumns };
  }

  const columns = splitSlideColumns(rest);
  if (columns.length <= 1) {
    return { title: null, columns: rawColumns };
  }

  return { title, columns };
}
