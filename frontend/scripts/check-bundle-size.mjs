#!/usr/bin/env node
// First-screen bundle size guard: sums the gzip size of every asset the
// entry document loads eagerly (modulepreload links, the entry script, and
// stylesheets) and fails when the total exceeds the budget.
//
// Usage: node scripts/check-bundle-size.mjs [distDir]
// Budget: BUNDLE_LIMIT_KB env (default 640)
import { readFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, basename } from "node:path";

const distDir = process.argv[2] ?? "../internal/static/dist";
const limitKB = Number(process.env.BUNDLE_LIMIT_KB ?? 640);
const indexHtml = readFileSync(join(distDir, "index.html"), "utf8");

const urls = [];
for (const m of indexHtml.matchAll(/(?:modulepreload|stylesheet)"[^>]*?href="([^"]+)"/g)) {
  urls.push(m[1]);
}
for (const m of indexHtml.matchAll(/<script[^>]*?src="([^"]+)"/g)) {
  urls.push(m[1]);
}
if (urls.length === 0) {
  console.error("bundle-size: no eager assets found in index.html");
  process.exit(1);
}

let totalKB = 0;
const rows = [];
for (const url of urls) {
  const file = join(distDir, url.replace(/^\//, ""));
  if (!existsSync(file)) {
    console.error(`bundle-size: missing asset ${url}`);
    process.exit(1);
  }
  const kb = Math.round(gzipSync(readFileSync(file)).length / 1024);
  totalKB += kb;
  rows.push([basename(file), `${kb} KB`]);
}
rows.push(["TOTAL", `${totalKB} KB (limit ${limitKB} KB)`]);
console.table(rows);

if (totalKB > limitKB) {
  console.error(
    `bundle-size: first-screen payload ${totalKB} KB exceeds the ${limitKB} KB budget. ` +
      "Heavy dependencies must stay lazy — see docs/roadmap.md §2.1.",
  );
  process.exit(1);
}
