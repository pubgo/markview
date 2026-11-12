import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OutlineTreeList } from "./OutlineTreeList";
import type { OutlineTreeNode } from "./outlineTreeModel";

const root: OutlineTreeNode = {
  id: "root",
  data: { value: "文档", depth: 0 },
  children: [
    {
      id: "fl_a1",
      data: {
        value: "alpha.md",
        depth: 1,
        isFile: true,
        hasChildren: true,
        fileId: "a1",
        group: "default",
      },
      children: [
        {
          id: "h1",
          data: { value: "Alpha", depth: 2, isH1: true, fileId: "a1", group: "default" },
        },
      ],
    },
  ],
};

describe("OutlineTreeList", () => {
  it("renders indented labels and hides children when collapsed", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    const { rerender } = render(
      <OutlineTreeList
        root={root}
        collapsedIds={new Set()}
        onToggleCollapse={onToggle}
        onOpenNode={onOpen}
      />,
    );
    expect(screen.getByText("alpha.md")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();

    rerender(
      <OutlineTreeList
        root={root}
        collapsedIds={new Set(["fl_a1"])}
        onToggleCollapse={onToggle}
        onOpenNode={onOpen}
      />,
    );
    expect(screen.getByText("alpha.md")).toBeTruthy();
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("chevron toggles collapse; label click opens", () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    render(
      <OutlineTreeList
        root={root}
        collapsedIds={new Set()}
        onToggleCollapse={onToggle}
        onOpenNode={onOpen}
      />,
    );
    fireEvent.click(screen.getByTestId("outline-tree-toggle-fl_a1"));
    expect(onToggle).toHaveBeenCalledWith("fl_a1");
    fireEvent.click(screen.getByText("Alpha"));
    expect(onOpen).toHaveBeenCalled();
  });
});
