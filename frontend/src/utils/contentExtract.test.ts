import { describe, expect, it } from "vitest";
import { extractFromContent, extractFromFiles } from "./contentExtract";

const base = {
  fileId: "f1",
  fileName: "a.md",
  groupName: "default",
};

describe("extractFromContent", () => {
  it("collects incomplete and complete todos with jump text without markers", () => {
    const hits = extractFromContent({
      ...base,
      content: ["- [ ] ship", "- [x] done", "* [ ] other"].join("\n"),
    });
    const todos = hits.filter((h) => h.kind === "todo");
    expect(todos).toHaveLength(3);
    expect(todos.filter((t) => !t.done).map((t) => t.label)).toEqual(["ship", "other"]);
    expect(todos.find((t) => t.done)?.label).toBe("done");
    expect(todos[0].lineText).toBe("ship");
    expect(todos[0].query).toBe("ship");
  });

  it("only matches #tag# delimiters, not bare #tag or headings", () => {
    const hits = extractFromContent({
      ...base,
      content: ["# Title", "bare #notag here", "use #real# please", "color #fff"].join("\n"),
    });
    expect(hits.filter((h) => h.kind === "tag").map((h) => h.key)).toEqual(["real"]);
  });

  it("ignores tags and wiki inside fenced code", () => {
    const hits = extractFromContent({
      ...base,
      content: ["```", "#secret# [[hidden]]", "```", "See #public# and [[shown]]"].join("\n"),
    });
    expect(hits.filter((h) => h.kind === "tag").map((h) => h.key)).toEqual(["public"]);
    expect(hits.filter((h) => h.kind === "topic").map((h) => h.key)).toEqual(["shown"]);
  });

  it("reads frontmatter tags", () => {
    const hits = extractFromContent({
      ...base,
      content: ["---", "tags:", "- security", "- api", "---", "body"].join("\n"),
    });
    expect(
      hits
        .filter((h) => h.kind === "tag")
        .map((h) => h.key)
        .sort(),
    ).toEqual(["api", "security"]);
    expect(hits.find((h) => h.key === "security")?.label).toBe("#security#");
  });

  it("parses piped wiki links and ignores markdown links", () => {
    const hits = extractFromContent({
      ...base,
      content: "See [[docs/setup|Setup]] and [wiki](wiki.md) plus [[plain]]",
    });
    const topics = hits.filter((h) => h.kind === "topic");
    expect(topics.map((h) => h.key).sort()).toEqual(["docs/setup", "plain"]);
    expect(topics.find((h) => h.key === "docs/setup")?.label).toBe("[[docs/setup|Setup]]");
    expect(
      topics.every((h) => !h.sourceLine.includes("[wiki](wiki.md)") || h.label.startsWith("[[")),
    ).toBe(true);
  });
});

describe("extractFromFiles", () => {
  it("sorts by file name then line", () => {
    const hits = extractFromFiles([
      { ...base, fileId: "b", fileName: "b.md", content: "- [ ] second" },
      { ...base, fileId: "a", fileName: "a.md", content: "- [ ] first\n- [ ] also" },
    ]);
    expect(hits.map((h) => `${h.fileName}:${h.label}`)).toEqual([
      "a.md:first",
      "a.md:also",
      "b.md:second",
    ]);
  });
});
