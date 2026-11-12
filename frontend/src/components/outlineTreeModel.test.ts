import { describe, expect, it } from "vitest";
import type { Outline } from "../hooks/useApi";
import {
  collectDefaultCollapsedIds,
  outlineToTreeData,
  OUTLINE_TREE_ROOT_ID,
} from "./outlineTreeModel";

function sampleOutline(): Outline {
  return {
    files: [
      {
        id: "a1",
        name: "alpha.md",
        group: "default",
        headings: [
          { level: 1, text: "Alpha", linkedFileIds: [] },
          { level: 2, text: "Detail", linkedFileIds: ["b2"] },
        ],
      },
      {
        id: "b2",
        name: "beta.md",
        group: "default",
        headings: [{ level: 1, text: "Beta", linkedFileIds: [] }],
      },
    ],
  };
}

describe("outlineToTreeData", () => {
  it("builds root → files → headings with depths", () => {
    const root = outlineToTreeData(sampleOutline(), new Set());
    expect(root.id).toBe(OUTLINE_TREE_ROOT_ID);
    expect(root.children?.length).toBeGreaterThan(0);
    const file = root.children![0];
    expect(file.data.isFile).toBe(true);
    expect(file.data.depth).toBe(1);
  });

  it("omits children when file id is collapsed", () => {
    const collapsed = new Set(["fl_a1"]);
    const root = outlineToTreeData(sampleOutline(), collapsed);
    const file = root.children!.find((c) => c.id === "fl_a1");
    expect(file?.children).toBeUndefined();
  });
});

describe("collectDefaultCollapsedIds", () => {
  it("returns a Set including root or files for large outlines", () => {
    const ids = collectDefaultCollapsedIds(sampleOutline());
    expect(ids).toBeInstanceOf(Set);
  });
});
