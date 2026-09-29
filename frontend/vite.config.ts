import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import license from "rollup-plugin-license";
import path from "node:path";

const enableCreditsGeneration = process.env.MARKVIEW_BUILD_CREDITS === "1";

const creditsPlugin = license({
  thirdParty: {
    output: {
      file: path.resolve(__dirname, "CREDITS_FRONTEND"),
      template(dependencies) {
        return dependencies
          .map(
            (dep) => {
              const repo = typeof dep.repository === "string"
                ? dep.repository
                : dep.repository?.url || "";
              const url = repo || dep.homepage || "";
              return `${dep.name}\n${url}\n----------------------------------------------------------------\n${dep.licenseText || `License: ${dep.license}`}\n`;
            },
          )
          .join(
            "\n================================================================\n\n",
          );
      },
    },
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../internal/static/dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // Vite/rolldown helper modules ("\0vite/preload-helper.js" and
              // friends) must live in an always-eager chunk. Rolldown otherwise
              // places them in whichever chunk is emitted first (here: mermaid),
              // which would turn that lazy chunk into a static dependency of
              // the entry and drag it into the modulepreload graph.
              name: "runtime-helpers",
              test: /\0/,
              priority: 100,
            },
            // Shiki themes & languages — largest payload, rarely all loaded at once
            { name: "shiki", test: /[\\/]node_modules[\\/](shiki|@shikijs)[\\/]/ },
            // Mermaid + beautiful-mermaid (loaded on demand per diagram)
            {
              name: "mermaid",
              test: /[\\/]node_modules[\\/](mermaid|@mermaid-js|beautiful-mermaid)[\\/]/,
            },
            // D3 (used by mermaid and graph views)
            { name: "d3", test: /[\\/]node_modules[\\/]d3[\\/]/ },
            // KaTeX
            { name: "katex", test: /[\\/]node_modules[\\/](katex|rehype-katex)[\\/]/ },
            // AntV G6 (graph views)
            { name: "antv", test: /[\\/]node_modules[\\/]@antv[\\/]/ },
            // PDF export
            { name: "pdf", test: /[\\/]node_modules[\\/](jspdf|html-to-image)[\\/]/ },
            // React core
            { name: "react", test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
    rollupOptions: {
      plugins: enableCreditsGeneration ? [creditsPlugin] : [],
    },
  },
  server: {
    proxy: {
      "/_/": "http://localhost:6275",
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["src/test-setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/utils/**", "src/hooks/**", "src/components/**"],
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
    },
  },
});
