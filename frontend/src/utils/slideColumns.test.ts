import { describe, expect, it } from "vitest";
import { parseSlideColumnLayout, splitSlideColumns } from "./slideColumns";

describe("splitSlideColumns", () => {
  it("returns a single column when there is no separator", () => {
    expect(splitSlideColumns("# Title\n\nBody")).toEqual(["# Title\n\nBody"]);
  });

  it("splits on a ||| line into two columns", () => {
    expect(
      splitSlideColumns(["## 左", "", "- a", "", "|||", "", "## 右", "", "- b"].join("\n")),
    ).toEqual(["## 左\n\n- a", "## 右\n\n- b"]);
  });

  it("ignores ||| inside fenced code", () => {
    const md = ["# Demo", "", "```", "|||", "```", "", "still one"].join("\n");
    expect(splitSlideColumns(md)).toEqual([md]);
  });

  it("supports more than two columns", () => {
    expect(splitSlideColumns("A\n|||\nB\n|||\nC")).toEqual(["A", "B", "C"]);
  });
});

describe("parseSlideColumnLayout", () => {
  it("returns a single column with no shared title when there is no separator", () => {
    expect(parseSlideColumnLayout("# Title\n\nBody")).toEqual({
      title: null,
      columns: ["# Title\n\nBody"],
    });
  });

  it("peels a leading heading when column headings are deeper", () => {
    const md = [
      "## 三栏也可以",
      "",
      "### 写",
      "",
      "A",
      "",
      "|||",
      "",
      "### 展",
      "",
      "B",
      "",
      "|||",
      "",
      "### 存",
      "",
      "C",
    ].join("\n");
    expect(parseSlideColumnLayout(md)).toEqual({
      title: "## 三栏也可以",
      columns: ["### 写\n\nA", "### 展\n\nB", "### 存\n\nC"],
    });
  });

  it("keeps equal-level headings inside columns (no shared title)", () => {
    const md = ["## 左栏", "", "- A", "", "|||", "", "## 右栏", "", "- B"].join("\n");
    expect(parseSlideColumnLayout(md)).toEqual({
      title: null,
      columns: ["## 左栏\n\n- A", "## 右栏\n\n- B"],
    });
  });

  it("does not peel a heading that is itself the first column", () => {
    const md = ["### 左", "|||", "### 右"].join("\n");
    expect(parseSlideColumnLayout(md)).toEqual({
      title: null,
      columns: ["### 左", "### 右"],
    });
  });
});
