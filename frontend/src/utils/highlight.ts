let codeToHtmlPromise: Promise<(typeof import("shiki"))["codeToHtml"]> | null = null;

/** Load shiki on demand — the bundled highlighter is ~1.6MB gzip. */
function loadCodeToHtml(): Promise<(typeof import("shiki"))["codeToHtml"]> {
  codeToHtmlPromise ??= import("shiki").then((m) => m.codeToHtml);
  return codeToHtmlPromise;
}

/** Highlight code to HTML, falling back to plaintext for unknown languages. */
export async function highlightToHtml(code: string, lang: string): Promise<string> {
  const codeToHtml = await loadCodeToHtml();
  try {
    return await codeToHtml(code, { lang, theme: "github-dark" });
  } catch {
    return await codeToHtml(code, { lang: "text", theme: "github-dark" });
  }
}
