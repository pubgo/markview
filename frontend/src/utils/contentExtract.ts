export type ExtractKind = "todo" | "tag" | "topic";

export interface ExtractSourceFile {
  fileId: string;
  fileName: string;
  groupName: string;
  content: string;
}

export interface ExtractHit {
  kind: ExtractKind;
  key: string;
  label: string;
  done?: boolean;
  fileId: string;
  fileName: string;
  groupName: string;
  lineNumber: number;
  lineText: string;
  query: string;
}

const TODO_RE = /^(\s*[-*+]|\s*\d+\.)\s+\[([ xX])\]\s+(.*)$/;
const TAG_RE = /(^|[^#\w/.-])#([A-Za-z][\w/-]*)/g;
const WIKI_RE = /\[\[([^\]]+)\]\]/g;
const HEADING_RE = /^#{1,6}\s/;

function parseFrontmatterTags(yaml: string): string[] {
  const tags: string[] = [];
  const inline = yaml.match(/^tags:\s*\[([^\]]*)\]\s*$/m);
  if (inline) {
    for (const part of inline[1].split(",")) {
      const t = part.trim().replace(/^["']|["']$/g, "");
      if (t) tags.push(t);
    }
    return tags;
  }

  const lines = yaml.split(/\r?\n/);
  let inTags = false;
  for (const line of lines) {
    if (/^tags:\s*$/.test(line)) {
      inTags = true;
      continue;
    }
    if (inTags) {
      const item = line.match(/^\s*-\s+(.+)\s*$/);
      if (item) {
        tags.push(item[1].trim().replace(/^["']|["']$/g, ""));
        continue;
      }
      if (/^\S/.test(line)) inTags = false;
    }
  }
  return tags;
}

function parseWikiInner(inner: string): { key: string; label: string } {
  const pipe = inner.indexOf("|");
  if (pipe === -1) {
    const key = inner.trim();
    return { key, label: key };
  }
  const left = inner.slice(0, pipe).trim();
  const right = inner.slice(pipe + 1).trim();
  const pathish = (s: string) => /[./#]|\.mdx?$/i.test(s) || (!/\s/.test(s) && s.length > 0);
  if (pathish(left) && !pathish(right)) return { key: left, label: right || left };
  if (pathish(right) && !pathish(left)) return { key: right, label: left || right };
  return { key: left, label: right || left };
}

/** Line numbers that fall inside YAML frontmatter (1-based), empty if none. */
function frontmatterLineRange(content: string): { endLine: number; yaml: string } | null {
  if (!content.startsWith("---")) return null;
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== "---") return null;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      return { endLine: i + 1, yaml: lines.slice(1, i).join("\n") };
    }
  }
  return null;
}

export function extractFromContent(file: ExtractSourceFile): ExtractHit[] {
  const hits: ExtractHit[] = [];
  const lines = file.content.split(/\r?\n/);
  const fm = frontmatterLineRange(file.content);

  if (fm) {
    for (const tag of parseFrontmatterTags(fm.yaml)) {
      hits.push({
        kind: "tag",
        key: tag,
        label: `#${tag}`,
        fileId: file.fileId,
        fileName: file.fileName,
        groupName: file.groupName,
        lineNumber: Math.min(fm.endLine + 1, lines.length) || 1,
        lineText: `tags: ${tag}`,
        query: tag,
      });
    }
  }

  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineNumber = i + 1;
    const inFrontmatter = fm != null && lineNumber <= fm.endLine;

    const fenceOpen = line.match(/^(`{3,}|~{3,})/);
    if (!inFence && fenceOpen) {
      inFence = true;
      fenceChar = fenceOpen[1][0];
      fenceLen = fenceOpen[1].length;
      continue;
    }
    if (inFence) {
      const close = line.match(/^(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fenceChar && close[1].length >= fenceLen) {
        inFence = false;
      }
      continue;
    }

    if (inFrontmatter) continue;

    const todo = line.match(TODO_RE);
    if (todo) {
      const done = todo[2].toLowerCase() === "x";
      const text = todo[3].trim();
      hits.push({
        kind: "todo",
        key: text,
        label: text,
        done,
        fileId: file.fileId,
        fileName: file.fileName,
        groupName: file.groupName,
        lineNumber,
        lineText: line.trim(),
        query: text.slice(0, 48),
      });
    }

    if (!HEADING_RE.test(line)) {
      TAG_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = TAG_RE.exec(line)) !== null) {
        const tag = m[2];
        hits.push({
          kind: "tag",
          key: tag,
          label: `#${tag}`,
          fileId: file.fileId,
          fileName: file.fileName,
          groupName: file.groupName,
          lineNumber,
          lineText: line.trim(),
          query: `#${tag}`,
        });
      }
    }

    WIKI_RE.lastIndex = 0;
    let w: RegExpExecArray | null;
    while ((w = WIKI_RE.exec(line)) !== null) {
      const { key, label } = parseWikiInner(w[1]);
      if (!key) continue;
      hits.push({
        kind: "topic",
        key,
        label: `[[${label}]]`,
        fileId: file.fileId,
        fileName: file.fileName,
        groupName: file.groupName,
        lineNumber,
        lineText: line.trim(),
        query: label,
      });
    }
  }

  return hits;
}

export function extractFromFiles(files: ExtractSourceFile[]): ExtractHit[] {
  return files.flatMap(extractFromContent).sort((a, b) => {
    const byName = a.fileName.localeCompare(b.fileName);
    if (byName !== 0) return byName;
    return a.lineNumber - b.lineNumber;
  });
}
