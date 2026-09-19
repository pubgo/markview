/** Max characters for an optional cover subtitle paragraph. */
export const SLIDE_COVER_MAX_PARAGRAPH_CHARS = 80;

/**
 * Returns true when slide markdown looks like a short title/cover page.
 * Source-line heuristic (no AST): one #/## heading, at most two short paragraphs,
 * no lists/tables/fences/blockquotes.
 */
export function isSlideCover(markdown: string): boolean {
  const lines = markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return false;

  let headingCount = 0;
  let paragraphCount = 0;
  let inFence = false;
  let fenceChar: "`" | "~" | "" = "";
  let fenceLen = 0;

  for (const raw of lines) {
    const line = raw.trim();

    const fence = line.match(/^(`{3,}|~{3,})/);
    if (fence) {
      const marker = fence[1] ?? "";
      if (!inFence) {
        inFence = true;
        fenceChar = (marker[0] as "`" | "~") ?? "";
        fenceLen = marker.length;
        return false;
      }
      const expected = fenceChar.repeat(fenceLen);
      if (line.startsWith(expected)) {
        inFence = false;
        fenceChar = "";
        fenceLen = 0;
      }
      return false;
    }
    if (inFence) return false;

    if (/^#{1,6}\s+\S/.test(line)) {
      if (!/^#{1,2}\s+\S/.test(line)) return false;
      headingCount += 1;
      if (headingCount > 1) return false;
      continue;
    }

    if (/^>\s?/.test(line)) return false;
    if (/^([-*+]|\d+\.)\s+/.test(line)) return false;
    if (/^\|/.test(line) || /\|.+\|/.test(line)) return false;
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) return false;

    paragraphCount += 1;
    if (paragraphCount > 2) return false;
    if (line.length > SLIDE_COVER_MAX_PARAGRAPH_CHARS) return false;
  }

  return headingCount === 1;
}
