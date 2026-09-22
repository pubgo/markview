import { extractSlideNotes } from "./slideNotes";

const TITLE_MAX = 40;

/**
 * Short label for teleprompter prev/next rows: first heading, else truncated body.
 */
export function slidePreviewTitle(markdown: string): string {
  const { body } = extractSlideNotes(markdown);
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}[ \t]+(.+)$/);
    if (heading) {
      return (heading[1] ?? "").trim() || "（空页）";
    }
    return line.length > TITLE_MAX ? line.slice(0, TITLE_MAX) : line;
  }
  return "（空页）";
}
