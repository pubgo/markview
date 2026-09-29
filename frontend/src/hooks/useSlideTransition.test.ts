import { describe, expect, it, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSlideTransition, SLIDE_TRANSITION_DEFAULT } from "./useSlideTransition";

describe("useSlideTransition", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to fade", () => {
    const { result } = renderHook(() => useSlideTransition());
    expect(result.current[0]).toBe(SLIDE_TRANSITION_DEFAULT);
    expect(SLIDE_TRANSITION_DEFAULT).toBe("fade");
  });

  it("persists the selected transition", () => {
    const { result } = renderHook(() => useSlideTransition());
    act(() => result.current[1]("slide"));
    expect(result.current[0]).toBe("slide");
    expect(localStorage.getItem("markview-slide-transition")).toBe("slide");
  });

  it("rejects unknown stored values", async () => {
    localStorage.setItem("markview-slide-transition", "weird");
    vi.resetModules();
    const mod = await import("./useSlideTransition");
    const { result } = renderHook(() => mod.useSlideTransition());
    expect(result.current[0]).toBe("fade");
  });
});
