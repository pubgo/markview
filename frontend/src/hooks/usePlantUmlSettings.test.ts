import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  getPlantUmlServerUrl,
  usePlantUmlSettings,
  PLANTUML_SERVER_URL_DEFAULT,
} from "./usePlantUmlSettings";

describe("usePlantUmlSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to the public kroki endpoint", () => {
    expect(getPlantUmlServerUrl()).toBe(PLANTUML_SERVER_URL_DEFAULT);
  });

  it("persists a custom server url and strips trailing slashes", () => {
    const { result } = renderHook(() => usePlantUmlSettings());
    act(() => result.current[1]({ serverUrl: "http://localhost:8000///" }));
    expect(getPlantUmlServerUrl()).toBe("http://localhost:8000");
    expect(localStorage.getItem("markview-plantuml-settings")).toContain("localhost");
  });

  it("reset restores the public endpoint", () => {
    const { result } = renderHook(() => usePlantUmlSettings());
    act(() => result.current[1]({ serverUrl: "http://localhost:8000" }));
    act(() => result.current[2]());
    expect(getPlantUmlServerUrl()).toBe(PLANTUML_SERVER_URL_DEFAULT);
  });
});
