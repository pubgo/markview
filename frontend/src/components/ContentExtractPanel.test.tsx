import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContentExtractControl } from "./ContentExtractPanel";

vi.mock("../hooks/useApi", () => ({
  fetchFileContent: vi.fn(async () => ({
    content: [
      "---",
      "tags:",
      "- security",
      "---",
      "",
      "- [ ] ship auth",
      "See [[topic]] and [wiki](wiki.md) #security#",
    ].join("\n"),
  })),
}));

const group = {
  name: "default",
  files: [{ id: "f1", name: "a.md", path: "/a.md" }],
};

describe("ContentExtractControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to TODO tab and jumps with plain task text", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <ContentExtractControl
        isOpen
        group={group}
        onClose={onClose}
        onSelect={onSelect}
        onToggle={() => {}}
      />,
    );

    expect(await screen.findByText("ship auth")).toBeInTheDocument();
    await user.click(screen.getByText("ship auth"));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: "f1",
        lineText: "ship auth",
        query: "ship auth",
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("shows #tag# and [[wiki]] only, not markdown links", async () => {
    const user = userEvent.setup();
    render(
      <ContentExtractControl
        isOpen
        group={group}
        onClose={() => {}}
        onSelect={() => {}}
        onToggle={() => {}}
      />,
    );

    await screen.findByText("ship auth");
    await user.click(screen.getByRole("button", { name: "标签" }));
    expect(await screen.findAllByText(/#security#/)).not.toHaveLength(0);
    await user.click(screen.getByRole("button", { name: "话题" }));
    expect(await screen.findByText("[[topic]]")).toBeInTheDocument();
    expect(screen.queryByText("[wiki](wiki.md)")).toBeNull();
  });
});
