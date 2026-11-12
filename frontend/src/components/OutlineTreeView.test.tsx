import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../hooks/useApi", () => ({
  fetchOutline: vi.fn(),
}));

vi.mock("@antv/g6", () => {
  class Graph {
    destroyed = false;
    render() {}
    destroy() {}
    on() {}
    off() {}
    setSize() {}
    getNodeData() {
      return undefined;
    }
    getParentData() {
      return undefined;
    }
  }
  return {
    Graph,
    idOf: (d: { id?: string }) => d.id ?? "",
    positionOf: () => [0, 0] as [number, number],
    treeToGraphData: (tree: unknown) => tree,
  };
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fetchOutline } from "../hooks/useApi";
import { OutlineTreeView } from "./OutlineTreeView";

const mockedFetch = vi.mocked(fetchOutline);

const sampleOutline = {
  files: [
    {
      id: "a1",
      name: "alpha.md",
      group: "default",
      headings: [
        { level: 1, text: "Alpha", linkedFileIds: [] },
        { level: 2, text: "Detail", linkedFileIds: [] },
      ],
    },
  ],
};

describe("OutlineTreeView", () => {
  beforeEach(() => {
    localStorage.clear();
    mockedFetch.mockReset();
    mockedFetch.mockResolvedValue(sampleOutline);
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  it("defaults to 大纲 list mode", async () => {
    render(<OutlineTreeView onClose={() => {}} />);
    expect(await screen.findByRole("tab", { name: "大纲" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("alpha.md")).toBeTruthy();
    expect(screen.queryByTestId("outline-tree-mindmap")).toBeNull();
  });

  it("switches to 导图 and persists mode", async () => {
    render(<OutlineTreeView onClose={() => {}} />);
    await screen.findByText("alpha.md");
    fireEvent.click(screen.getByRole("tab", { name: "导图" }));
    await waitFor(() => {
      expect(localStorage.getItem("markview-outline-tree-mode")).toBe("mindmap");
    });
    expect(screen.getByTestId("outline-tree-mindmap")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "导图" })).toHaveAttribute("aria-selected", "true");
  });

  it("defaults layout direction toggle to 纵向 when unset", async () => {
    localStorage.removeItem("markview-outline-layout-direction");
    render(<OutlineTreeView onClose={() => {}} />);
    await screen.findByText("alpha.md");
    fireEvent.click(screen.getByRole("tab", { name: "导图" }));
    expect(await screen.findByRole("button", { name: "纵向" })).toBeTruthy();
  });
});
