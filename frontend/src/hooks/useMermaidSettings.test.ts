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

  it("defaults renderer to pele and theme to auto", () => {
    expect(MERMAID_SETTINGS_DEFAULTS.renderer).toBe("pele");
    expect(MERMAID_SETTINGS_DEFAULTS.theme).toBe("auto");
    expect(getMermaidSettings().renderer).toBe("pele");
    expect(getMermaidSettings().theme).toBe("auto");
  });

  it("fills missing renderer as pele when merging stored settings", () => {
    localStorage.setItem(
      "markview-mermaid-settings",
      JSON.stringify({ theme: "nord", nodeSpacing: 40 }),
    );
    invalidateMermaidSettingsCache();
    const settings = getMermaidSettings();
    expect(settings.renderer).toBe("pele");
    expect(settings.theme).toBe("nord");
    expect(settings.nodeSpacing).toBe(40);
  });

  it("migrates stored beautiful renderer to pele", () => {
    localStorage.setItem(
      "markview-mermaid-settings",
      JSON.stringify({ renderer: "beautiful", theme: "custom" }),
    );
    invalidateMermaidSettingsCache();
    expect(getMermaidSettings().renderer).toBe("pele");
  });

  it("preserves an explicit native renderer from storage", () => {
    localStorage.setItem(
      "markview-mermaid-settings",
      JSON.stringify({ renderer: "native", theme: "auto" }),
    );
    invalidateMermaidSettingsCache();
    expect(getMermaidSettings().renderer).toBe("native");
  });

  it("preset settings omit renderer so applying a preset cannot wipe it", () => {
    for (const preset of MERMAID_PRESETS) {
      expect("renderer" in preset.settings).toBe(false);
    }
  });
});
