import { getMermaidSettings, type MermaidSettings } from "../hooks/useMermaidSettings";

const GITHUB_LIGHT = {
  bg: "#ffffff",
  surface: "#f6f8fa",
  fg: "#24292f",
  line: "#57606a",
  border: "#0969da",
  muted: "#656d76",
  accent: "#0969da",
};

const GITHUB_DARK = {
  bg: "#0d1117",
  surface: "#161b22",
  fg: "#e6edf3",
  line: "#8b949e",
  border: "#58a6ff",
  muted: "#8b949e",
  accent: "#4493f8",
};

export const MERMAID_PALETTES: Record<string, Record<string, string>> = {
  "github-light": {
    bg: GITHUB_LIGHT.bg,
    fg: GITHUB_LIGHT.fg,
    line: GITHUB_LIGHT.line,
    accent: GITHUB_LIGHT.accent,
    muted: GITHUB_LIGHT.muted,
    surface: GITHUB_LIGHT.surface,
    border: GITHUB_LIGHT.border,
  },
  "github-dark": {
    bg: GITHUB_DARK.bg,
    fg: GITHUB_DARK.fg,
    line: GITHUB_DARK.line,
    accent: GITHUB_DARK.accent,
    muted: GITHUB_DARK.muted,
    surface: GITHUB_DARK.surface,
    border: GITHUB_DARK.border,
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

export function resolveMermaidPalette(settings: MermaidSettings): Record<string, string> {
  const isDark = isDarkTheme();

  switch (settings.theme) {
    case "github-light":
      return MERMAID_PALETTES["github-light"];
    case "github-dark":
      return MERMAID_PALETTES["github-dark"];
    case "tokyo-night":
      return isDark ? MERMAID_PALETTES["tokyo-night-dark"] : MERMAID_PALETTES["tokyo-night-light"];
    case "nord":
      return isDark ? MERMAID_PALETTES["nord-dark"] : MERMAID_PALETTES["nord-light"];
    case "high-contrast":
      return isDark
        ? MERMAID_PALETTES["high-contrast-dark"]
        : MERMAID_PALETTES["high-contrast-light"];
    case "auto":
      return isDark ? MERMAID_PALETTES["github-dark"] : MERMAID_PALETTES["github-light"];
    default: // "custom"
      return isDark ? MERMAID_PALETTES["custom-dark"] : MERMAID_PALETTES["custom-light"];
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

function applyGithubNativeVars(
  out: Record<string, string | boolean>,
  palette: typeof GITHUB_LIGHT,
): void {
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
}

export function resolveNativeMermaidThemeVariables(
  settings: MermaidSettings = getMermaidSettings(),
): Record<string, string | boolean> {
  const isDark = isDarkTheme();
  const out: Record<string, string | boolean> = {
    darkMode: isDark,
    fontFamily: "system-ui",
  };

  if (settings.theme === "github-light") {
    applyGithubNativeVars(out, GITHUB_LIGHT);
    out.darkMode = false;
    return out;
  }
  if (settings.theme === "github-dark") {
    applyGithubNativeVars(out, GITHUB_DARK);
    out.darkMode = true;
    return out;
  }

  if (settings.theme === "auto") {
    const fallback = isDark ? GITHUB_DARK : GITHUB_LIGHT;
    const bg = resolveCssColor("--color-gh-bg") ?? fallback.bg;
    const surface = resolveCssColor("--color-gh-bg-secondary") ?? fallback.surface;
    const hover = resolveCssColor("--color-gh-bg-hover") ?? surface;
    const fg = resolveCssColor("--color-gh-text") ?? fallback.fg;
    const muted = resolveCssColor("--color-gh-text-secondary") ?? fallback.muted;
    const border = resolveCssColor("--color-gh-border") ?? fallback.border;
    const accent =
      resolveCssColor("--color-gh-accent") ?? (isDark ? GITHUB_DARK.accent : GITHUB_LIGHT.accent);

    out.background = bg;
    out.edgeLabelBackground = bg;
    out.mainBkg = surface;
    out.primaryColor = surface;
    out.secondaryColor = hover;
    out.tertiaryColor = hover;
    out.clusterBkg = hover;
    out.primaryTextColor = fg;
    out.textColor = fg;
    out.titleColor = fg;
    out.lineColor = muted;
    out.tertiaryTextColor = muted;
    // Prefer accent for node borders (GitHub preview look); keep cluster on token border.
    out.primaryBorderColor = accent;
    out.clusterBorder = border;
    return out;
  }

  const palette = resolveMermaidPalette(settings);
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

/** CSS custom properties for Obsidian Pele diagrams (inherit into injected SVG). */
export function resolvePeleCssVariables(
  settings: MermaidSettings = getMermaidSettings(),
): Record<string, string> {
  const isDark = isDarkTheme();
  let bg: string | undefined;
  let surface: string | undefined;
  let surfaceAlt: string | undefined;
  let fg: string | undefined;
  let muted: string | undefined;
  let line: string | undefined;
  let border: string | undefined;
  let accent: string | undefined;

  if (settings.theme === "auto") {
    bg = resolveCssColor("--color-gh-bg");
    surface = resolveCssColor("--color-gh-bg-secondary");
    surfaceAlt = resolveCssColor("--color-gh-bg-hover");
    fg = resolveCssColor("--color-gh-text");
    muted = resolveCssColor("--color-gh-text-secondary");
    line = muted;
    border = resolveCssColor("--color-gh-border");
    accent = resolveCssColor("--color-gh-accent") ?? (isDark ? "#4493f8" : "#0969da");
  } else {
    const palette = resolveMermaidPalette(settings);
    bg = palette.bg;
    surface = palette.surface;
    surfaceAlt = palette.surface;
    fg = palette.fg;
    muted = palette.muted;
    line = palette.line;
    border = palette.border;
    accent = palette.accent;
  }

  const vars: Record<string, string> = {
    "--pele-font": "system-ui",
    "--pele-radius": "4px",
  };
  if (bg) vars["--pele-bg"] = bg;
  if (fg) vars["--pele-fg"] = fg;
  if (muted) vars["--pele-muted"] = muted;
  if (line) vars["--pele-line"] = line;
  if (surface) vars["--pele-surface"] = surface;
  if (surfaceAlt) vars["--pele-surface-alt"] = surfaceAlt;
  if (border) vars["--pele-border"] = border;
  if (accent) vars["--pele-accent"] = accent;
  return vars;
}
