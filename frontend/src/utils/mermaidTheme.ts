import {
  getMermaidSettings,
  type MermaidSettings,
} from "../hooks/useMermaidSettings";

export const BEAUTIFUL_MERMAID_PALETTES: Record<string, Record<string, string>> = {
  "github-light": {
    bg: "#ffffff",
    fg: "#1f2328",
    line: "#57606a",
    accent: "#0969da",
    muted: "#656d76",
    surface: "#f6f8fa",
    border: "#d0d7de",
  },
  "github-dark": {
    bg: "#0d1117",
    fg: "#e6edf3",
    line: "#8b949e",
    accent: "#4493f8",
    muted: "#8b949e",
    surface: "#161b22",
    border: "#30363d",
  },
  "high-contrast-light": {
    bg: "#ffffff",
    fg: "#0a0a0a",
    line: "#1a1a2e",
    accent: "#0550ae",
    muted: "#3d3d5c",
    surface: "#e8f0fe",
    border: "#1a1a2e",
  },
  "high-contrast-dark": {
    bg: "#0a0e1a",
    fg: "#f0f4ff",
    line: "#a0b4d0",
    accent: "#58a6ff",
    muted: "#8ea4c0",
    surface: "#111928",
    border: "#58a6ff",
  },
  "tokyo-night-light": {
    bg: "#d5d6db",
    fg: "#343b58",
    line: "#4c5580",
    accent: "#34548a",
    muted: "#68709a",
    surface: "#cbced8",
    border: "#4c5580",
  },
  "tokyo-night-dark": {
    bg: "#1a1b26",
    fg: "#c0caf5",
    line: "#565f89",
    accent: "#7aa2f7",
    muted: "#787c99",
    surface: "#24283b",
    border: "#414868",
  },
  "nord-light": {
    bg: "#eceff4",
    fg: "#2e3440",
    line: "#4c566a",
    accent: "#5e81ac",
    muted: "#7b88a1",
    surface: "#e5e9f0",
    border: "#4c566a",
  },
  "nord-dark": {
    bg: "#2e3440",
    fg: "#d8dee9",
    line: "#81a1c1",
    accent: "#88c0d0",
    muted: "#a3b8cc",
    surface: "#3b4252",
    border: "#4c566a",
  },
  "custom-light": {
    bg: "#ffffff",
    fg: "#0f172a",
    line: "#1e3a5f",
    accent: "#0044cc",
    muted: "#374151",
    surface: "#e0ecff",
    border: "#1e3a5f",
  },
  "custom-dark": {
    bg: "#0b1220",
    fg: "#f0f6ff",
    line: "#7da2cc",
    accent: "#4ea1ff",
    muted: "#94b0d0",
    surface: "#111a2b",
    border: "#5b8abf",
  },
};

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export function resolveBeautifulMermaidPalette(
  settings: MermaidSettings,
): Record<string, string> {
  const isDark = isDarkTheme();

  switch (settings.theme) {
    case "github-light":
      return BEAUTIFUL_MERMAID_PALETTES["github-light"];
    case "github-dark":
      return BEAUTIFUL_MERMAID_PALETTES["github-dark"];
    case "tokyo-night":
      return isDark
        ? BEAUTIFUL_MERMAID_PALETTES["tokyo-night-dark"]
        : BEAUTIFUL_MERMAID_PALETTES["tokyo-night-light"];
    case "nord":
      return isDark
        ? BEAUTIFUL_MERMAID_PALETTES["nord-dark"]
        : BEAUTIFUL_MERMAID_PALETTES["nord-light"];
    case "high-contrast":
      return isDark
        ? BEAUTIFUL_MERMAID_PALETTES["high-contrast-dark"]
        : BEAUTIFUL_MERMAID_PALETTES["high-contrast-light"];
    case "auto":
      return isDark
        ? BEAUTIFUL_MERMAID_PALETTES["github-dark"]
        : BEAUTIFUL_MERMAID_PALETTES["github-light"];
    default: // "custom"
      return isDark
        ? BEAUTIFUL_MERMAID_PALETTES["custom-dark"]
        : BEAUTIFUL_MERMAID_PALETTES["custom-light"];
  }
}

export function resolveCssColor(
  varName: string,
  el: Element = document.documentElement,
): string | undefined {
  const raw = getComputedStyle(el).getPropertyValue(varName).trim();
  if (!raw) return undefined;
  if (/^(#[0-9a-f]{3,8}|rgba?\([^)]*\))$/i.test(raw)) return raw;
  return undefined;
}

export function resolveNativeMermaidThemeVariables(
  settings: MermaidSettings = getMermaidSettings(),
): Record<string, string | boolean> {
  const isDark = isDarkTheme();
  const out: Record<string, string | boolean> = {
    darkMode: isDark,
    fontFamily: "system-ui",
  };

  if (settings.theme === "auto") {
    const bg = resolveCssColor("--color-gh-bg");
    const surface = resolveCssColor("--color-gh-bg-secondary");
    const hover = resolveCssColor("--color-gh-bg-hover");
    const fg = resolveCssColor("--color-gh-text");
    const muted = resolveCssColor("--color-gh-text-secondary");
    const border = resolveCssColor("--color-gh-border");
    if (bg) {
      out.background = bg;
      out.edgeLabelBackground = bg;
    }
    if (surface) {
      out.mainBkg = surface;
      out.primaryColor = surface;
    }
    if (hover) {
      out.secondaryColor = hover;
      out.tertiaryColor = hover;
      out.clusterBkg = hover;
    } else if (surface) {
      out.secondaryColor = surface;
      out.tertiaryColor = surface;
      out.clusterBkg = surface;
    }
    if (fg) {
      out.primaryTextColor = fg;
      out.textColor = fg;
      out.titleColor = fg;
    }
    if (muted) {
      out.lineColor = muted;
      out.tertiaryTextColor = muted;
    }
    if (border) {
      out.primaryBorderColor = border;
      out.clusterBorder = border;
    }
    return out;
  }

  const palette = resolveBeautifulMermaidPalette(settings);
  out.background = palette.bg;
  out.edgeLabelBackground = palette.bg;
  out.mainBkg = palette.surface;
  out.primaryColor = palette.surface;
  out.secondaryColor = palette.surface;
  out.tertiaryColor = palette.surface;
  out.clusterBkg = palette.surface;
  out.primaryTextColor = palette.fg;
  out.textColor = palette.fg;
  out.titleColor = palette.fg;
  out.lineColor = palette.line;
  out.tertiaryTextColor = palette.muted;
  out.primaryBorderColor = palette.border;
  out.clusterBorder = palette.border;
  return out;
}
