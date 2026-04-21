#!/usr/bin/env node
/**
 * Writes public/_redirects: legacy /wiki/ rules plus 301s for entries that
 * set canonicalEntryId in frontmatter (alias URL → canonical article URL).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WIKI = path.join(ROOT, "src/content/wiki");
const OUT = path.join(ROOT, "public/_redirects");

const STATIC = [
  "# Legacy URLs (used when the site lived under /wiki/)",
  "/wiki/   /dizin/   301",
  "/wiki/*  /:splat   301",
  "",
  "# canonicalEntryId aliases (generated — edit frontmatter + run npm run prebuild)",
];

function walkMd(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) out.push(...walkMd(p));
    else if (name.name.endsWith(".md")) out.push(p);
  }
  return out;
}

function readCanonicalEntryId(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.startsWith("---")) return null;
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return null;
  const yaml = raw.slice(4, end);
  for (const line of yaml.split("\n")) {
    const m = line.match(/^\s*canonicalEntryId:\s*(.+)\s*$/);
    if (!m) continue;
    let v = m[1].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    const hash = v.indexOf("#");
    if (hash >= 0) v = v.slice(0, hash).trim();
    return v || null;
  }
  return null;
}

function normalizeToPath(canonical) {
  const trimmed = canonical.replace(/^\/+|\/+$/g, "");
  return `/${trimmed}/`;
}

const lines = [...STATIC];

for (const file of walkMd(WIKI)) {
  const canonical = readCanonicalEntryId(file);
  if (!canonical) continue;
  const relUrl = path
    .relative(WIKI, file)
    .split(path.sep)
    .join("/")
    .replace(/\.md$/i, "");
  const fromPath = `/${relUrl}/`;
  const toPath = normalizeToPath(canonical);
  if (fromPath === toPath) continue;
  lines.push(`${fromPath}  ${toPath}  301`);
}

lines.push("");
fs.writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(
  "Wrote",
  path.relative(ROOT, OUT),
  "—",
  lines.length - STATIC.length - 1,
  "canonical redirect(s)"
);
