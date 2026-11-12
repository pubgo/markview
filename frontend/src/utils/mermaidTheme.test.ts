import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MERMAID_SETTINGS_DEFAULTS } from "../hooks/useMermaidSettings";
import { resolveNativeMermaidThemeVariables, resolvePeleCssVariables } from "./mermaidTheme";

describe("resolveNativeMermaidThemeVariables", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      () =>
        ({
          getPropertyValue: (name: string) => {
            const map: Record<string, string> = {
              "--color-gh-bg": "#0d1117",
              "--color-gh-bg-secondary": "#161b22",
              "--color-gh-bg-hover": "#21262d",
              "--color-gh-text": "#e6edf3",
              "--color-gh-text-secondary": "#8b949e",
              "--color-gh-border": "#30363d",
            };
            return map[name] ?? "";
          },
        }) as unknown as CSSStyleDeclaration,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute("data-theme");
  });

  it("maps auto theme from CSS tokens with darkMode true", () => {
    const vars = resolveNativeMermaidThemeVariables({
      ...MERMAID_SETTINGS_DEFAULTS,
      theme: "auto",
    });
    expect(vars.darkMode).toBe(true);
    expect(vars.background).toBe("#0d1117");
    expect(vars.mainBkg).toBe("#161b22");
    // auto uses accent for node borders (GitHub preview); cluster keeps token border
    expect(vars.primaryBorderColor).toBe("#4493f8");
    expect(vars.clusterBorder).toBe("#30363d");
    expect(vars.primaryTextColor).toBe("#e6edf3");
    expect(vars.lineColor).toBe("#8b949e");
    expect(vars.edgeLabelBackground).toBe("#0d1117");
    expect(vars.fontFamily).toBe("system-ui");
  });

  it("maps named github-dark palette into the same mermaid keys", () => {
    const vars = resolveNativeMermaidThemeVariables({
      ...MERMAID_SETTINGS_DEFAULTS,
      theme: "github-dark",
    });
    expect(vars.darkMode).toBe(true);
    expect(vars.background).toBe("#0d1117");
    expect(vars.primaryTextColor).toBe("#e6edf3");
    expect(vars.lineColor).toBe("#8b949e");
  });

  it("maps github-light to GitHub preview colours", () => {
    document.documentElement.setAttribute("data-theme", "light");
    const vars = resolveNativeMermaidThemeVariables({
      ...MERMAID_SETTINGS_DEFAULTS,
      theme: "github-light",
    });
    expect(vars.darkMode).toBe(false);
    expect(vars.background).toBe("#ffffff");
    expect(vars.mainBkg).toBe("#f6f8fa");
    expect(vars.primaryBorderColor).toBe("#0969da");
    expect(vars.primaryTextColor).toBe("#24292f");
    expect(vars.lineColor).toBe("#57606a");
  });

  it("maps github-dark to GitHub dark preview colours", () => {
    const vars = resolveNativeMermaidThemeVariables({
      ...MERMAID_SETTINGS_DEFAULTS,
      theme: "github-dark",
    });
    expect(vars.darkMode).toBe(true);
    expect(vars.background).toBe("#0d1117");
    expect(vars.mainBkg).toBe("#161b22");
    expect(vars.primaryBorderColor).toBe("#58a6ff");
    expect(vars.primaryTextColor).toBe("#e6edf3");
    expect(vars.lineColor).toBe("#8b949e");
  });
});

describe("resolvePeleCssVariables", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      () =>
        ({
          getPropertyValue: (name: string) => {
            const map: Record<string, string> = {
              "--color-gh-bg": "#0d1117",
              "--color-gh-bg-secondary": "#161b22",
              "--color-gh-bg-hover": "#21262d",
              "--color-gh-text": "#e6edf3",
              "--color-gh-text-secondary": "#8b949e",
              "--color-gh-border": "#30363d",
            };
            return map[name] ?? "";
          },
        }) as unknown as CSSStyleDeclaration,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.removeAttribute("data-theme");
  });

  it("maps auto theme tokens into --pele-* variables", () => {
    const vars = resolvePeleCssVariables({
      ...MERMAID_SETTINGS_DEFAULTS,
      theme: "auto",
    });
    expect(vars["--pele-bg"]).toBe("#0d1117");
    expect(vars["--pele-fg"]).toBe("#e6edf3");
    expect(vars["--pele-surface"]).toBe("#161b22");
    expect(vars["--pele-border"]).toBe("#30363d");
    expect(vars["--pele-font"]).toBe("system-ui");
  });
});
