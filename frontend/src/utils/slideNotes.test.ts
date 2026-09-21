import { describe, expect, it } from "vitest";
import { extractSlideNotes } from "./slideNotes";

describe("extractSlideNotes", () => {
  it("returns body unchanged when there are no comments", () => {
    expect(extractSlideNotes("# Hello\n\nWorld")).toEqual({
      body: "# Hello\n\nWorld",
      notes: "",
    });
  });

  it("extracts a single HTML comment as notes", () => {
    expect(extractSlideNotes("# 封面\n\n<!-- 强调本地优先，不要展开编辑器对比 -->\n")).toEqual({
      body: "# 封面",
      notes: "强调本地优先，不要展开编辑器对比",
    });
  });

  it("joins multiple comments with a blank line", () => {
    const result = extractSlideNotes(
      ["# 页", "<!-- 第一点 -->", "", "内容", "<!-- 第二点", "多行 -->"].join("\n"),
    );
    expect(result.body).toBe("# 页\n\n内容");
    expect(result.notes).toBe("第一点\n\n第二点\n多行");
  });

  it("ignores empty comments", () => {
    expect(extractSlideNotes("# A\n\n<!---->\n\n<!--   -->\n")).toEqual({
      body: "# A",
      notes: "",
    });
  });
});
