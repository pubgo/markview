/**
 * Marp-compatible speaker notes: HTML comments in a slide become notes
 * and are stripped from the audience-facing markdown body.
 */

const HTML_COMMENT_RE = /<!--([\s\S]*?)-->/g;

export function extractSlideNotes(markdown: string): { body: string; notes: string } {
  const parts: string[] = [];
  const body = markdown.replace(HTML_COMMENT_RE, (_whole, inner: string) => {
    const text = inner.replace(/\r\n/g, "\n").trim();
    if (text.length > 0) {
      parts.push(text);
    }
    return "";
  });

  const normalizedBody = body
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    body: normalizedBody,
    notes: parts.join("\n\n").trim(),
  };
}
