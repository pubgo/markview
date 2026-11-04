import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsModal } from "./SettingsModal";
import { invalidateMermaidSettingsCache } from "../hooks/useMermaidSettings";

describe("SettingsModal mermaid renderer", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateMermaidSettingsCache();
  });

  it("shows pele engine by default with padding enabled and beautiful-only sliders disabled", () => {
    render(<SettingsModal isOpen onClose={() => {}} />);
    const engine = screen.getByLabelText("渲染引擎") as HTMLSelectElement;
    expect(engine.value).toBe("pele");
    expect(screen.getByLabelText("画布边距")).not.toBeDisabled();
    expect(screen.getByLabelText("节点间距")).toBeDisabled();
    expect(screen.getByLabelText("层间距")).toBeDisabled();
    expect(screen.getByLabelText("交叉优化")).toBeDisabled();
    expect(screen.getByText(/仅 beautiful-mermaid/i)).toBeInTheDocument();
  });

  it("enables spacing sliders when switching to beautiful-mermaid", async () => {
    const user = userEvent.setup();
    render(<SettingsModal isOpen onClose={() => {}} />);
    await user.selectOptions(screen.getByLabelText("渲染引擎"), "beautiful");
    expect(screen.getByLabelText("节点间距")).not.toBeDisabled();
  });

  it("disables padding when switching to native", async () => {
    const user = userEvent.setup();
    render(<SettingsModal isOpen onClose={() => {}} />);
    await user.selectOptions(screen.getByLabelText("渲染引擎"), "native");
    expect(screen.getByLabelText("画布边距")).toBeDisabled();
    expect(screen.getByLabelText("节点间距")).toBeDisabled();
    expect(screen.getByLabelText("交叉优化")).toBeDisabled();
  });
});
