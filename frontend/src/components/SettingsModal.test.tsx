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

  it("shows pele by default with only padding enabled among layout sliders", () => {
    render(<SettingsModal isOpen onClose={() => {}} />);
    const engine = screen.getByLabelText("渲染引擎") as HTMLSelectElement;
    expect(engine.value).toBe("pele");
    expect(screen.queryByRole("option", { name: /beautiful/i })).toBeNull();
    expect(screen.getByLabelText("画布边距")).not.toBeDisabled();
    expect(screen.queryByLabelText("节点间距")).toBeNull();
    expect(screen.queryByLabelText("层间距")).toBeNull();
    expect(screen.queryByLabelText("交叉优化")).toBeNull();
  });

  it("disables padding when switching to native", async () => {
    const user = userEvent.setup();
    render(<SettingsModal isOpen onClose={() => {}} />);
    await user.selectOptions(screen.getByLabelText("渲染引擎"), "native");
    expect(screen.getByLabelText("画布边距")).toBeDisabled();
  });
});
