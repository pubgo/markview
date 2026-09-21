/**
 * In-slide column split: a line that is only `|||` (optionally spaced)
 * divides the slide into columns. Fence bodies are not scanned.
 */

const COLUMN_SEP_RE = /^\s*\|\|\|\s*$/;

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
