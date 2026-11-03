import { beforeEach, describe, expect, it } from "vitest";
import {
  MERMAID_PRESETS,
  MERMAID_SETTINGS_DEFAULTS,
  getMermaidSettings,
  invalidateMermaidSettingsCache,
} from "./useMermaidSettings";

describe("useMermaidSettings defaults", () => {
  beforeEach(() => {
    localStorage.clear();
    invalidateMermaidSettingsCache();
  });

  it("defaults renderer to native and theme to auto", () => {
    expect(MERMAID_SETTINGS_DEFAULTS.renderer).toBe("native");
    expect(MERMAID_SETTINGS_DEFAULTS.theme).toBe("auto");
    expect(getMermaidSettings().renderer).toBe("native");
    expect(getMermaidSettings().theme).toBe("auto");
  });

  it("fills missing renderer as native when merging stored settings", () => {
    localStorage.setItem(
      "markview-mermaid-settings",
      JSON.stringify({ theme: "nord", nodeSpacing: 40 }),
    );
    invalidateMermaidSettingsCache();
    const settings = getMermaidSettings();
    expect(settings.renderer).toBe("native");
    expect(settings.theme).toBe("nord");
    expect(settings.nodeSpacing).toBe(40);
  });

  it("preserves an explicit beautiful renderer from storage", () => {
    localStorage.setItem(
      "markview-mermaid-settings",
      JSON.stringify({ renderer: "beautiful", theme: "custom" }),
    );
    invalidateMermaidSettingsCache();
    expect(getMermaidSettings().renderer).toBe("beautiful");
  });

  it("preserves an explicit pele renderer from storage", () => {
    localStorage.setItem(
      "markview-mermaid-settings",
      JSON.stringify({ renderer: "pele", theme: "auto" }),
    );
    invalidateMermaidSettingsCache();
    expect(getMermaidSettings().renderer).toBe("pele");
  });

  it("preset settings omit renderer so applying a preset cannot wipe it", () => {
    for (const preset of MERMAID_PRESETS) {
      expect("renderer" in preset.settings).toBe(false);
    }
  });
});
