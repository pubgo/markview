import { describe, expect, it } from "vitest";
import { splitSlideColumns } from "./slideColumns";

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
