import { describe, expect, it } from "vitest";
import { extractFromContent, extractFromFiles } from "./contentExtract";

const base = {
  fileId: "f1",
  fileName: "a.md",
  groupName: "default",
};

describe("extractFromContent", () => {
  it("collects incomplete and complete todos", () => {
    const hits = extractFromContent({
      ...base,
      content: ["- [ ] ship", "- [x] done", "* [ ] other"].join("\n"),
    });
    const todos = hits.filter((h) => h.kind === "todo");
    expect(todos).toHaveLength(3);
    expect(todos.filter((t) => !t.done).map((t) => t.label)).toEqual(["ship", "other"]);
    expect(todos.find((t) => t.done)?.label).toBe("done");
  });

  it("ignores tags and wiki inside fenced code", () => {
    const hits = extractFromContent({
      ...base,
      content: ["```", "#secret [[hidden]]", "```", "See #public and [[shown]]"].join("\n"),
    });
    expect(hits.filter((h) => h.kind === "tag").map((h) => h.key)).toEqual(["public"]);
    expect(hits.filter((h) => h.kind === "topic").map((h) => h.key)).toEqual(["shown"]);
  });

  it("does not treat headings as tags", () => {
    const hits = extractFromContent({
      ...base,
      content: "# Title\n## Sub\ninline #real",
    });
    expect(hits.filter((h) => h.kind === "tag").map((h) => h.key)).toEqual(["real"]);
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
  });

  it("parses piped wiki links", () => {
    const hits = extractFromContent({
      ...base,
      content: "See [[docs/setup|Setup]]",
    });
    const topic = hits.find((h) => h.kind === "topic");
    expect(topic?.key).toBe("docs/setup");
    expect(topic?.label).toContain("Setup");
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
