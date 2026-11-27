// Machine-translate missing fr segments with protected terms; writes batch map JSON files.
// Usage: node i18n/translate-missing-fr.mjs [--batch N] [--from N] [--size 200] [--concurrency 12]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDict } from "./build.mjs";
import { OVERRIDES } from "./polish-fr-overrides.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = resolve(root, "i18n", "temp");
mkdirSync(tmpDir, { recursive: true });

const { missing: allMissing } = JSON.parse(readFileSync(resolve(root, "i18n", "missing-fr.json"), "utf8"));
const fr = loadDict(root, "fr");
const missing = allMissing.filter((s) => fr[s] === undefined);

const argv = process.argv.slice(2);
const arg = (name, def) => (argv.includes(name) ? Number(argv[argv.indexOf(name) + 1]) : def);
const batchOnly = argv.includes("--batch") ? arg("--batch", 0) : null;
const from = arg("--from", 0);
const size = arg("--size", 200);
const concurrency = arg("--concurrency", 12);

const TERMS = [
  "Sifra Labs",
  "MeDoc Dentist",
  "MeDoc",
  "Essentiel",
  "Cabinet+",
  "Cabinet",
  "React",
  "TypeScript",
  "Rust",
  "Tauri",
  "SQLite",
  "Vite",
  "Node.js",
  "Cloudflare Workers",
  "Cloudflare",
  "GitHub Actions",
  "GDPR",
  "Loi 09-08",
  "Law 09-08",
  "ESP32",
  "NDA",
  "WCAG",
  "SQLCipher",
  "sifralabs.com",
  "IBM",
  "Morocco",
  "Bill 52-26",
  "Loi 52-26",
  "MVP",
  "SaaS",
  "SMEs",
  "SME",
  "UI/UX",
  "ETL",
  "APIs",
  "API",
  "IoT",
  "macOS",
  "Linux",
  "Windows",
  "CNDP",
  "EHDS",
  "Fig.",
];

function protect(text) {
  let out = text;
  const map = new Map();
  let i = 0;
  for (const ent of ["&amp;", "&lt;", "&gt;", "&quot;", "&#39;"]) {
    const tok = `⟦E${i++}⟧`;
    if (out.includes(ent)) {
      map.set(tok, ent);
      out = out.split(ent).join(tok);
    }
  }
  for (const term of [...TERMS].sort((a, b) => b.length - a.length)) {
    const tok = `⟦T${i++}⟧`;
    if (out.includes(term)) {
      map.set(tok, term);
      out = out.split(term).join(tok);
    }
  }
  return { out, map };
}

function unprotect(text, map) {
  let out = text;
  for (const [tok, orig] of map) out = out.split(tok).join(orig);
  return out;
}

function polishVous(text) {
  return text
    .replace(/\bTes\b/g, "Vos")
    .replace(/\btes\b/g, "vos")
    .replace(/\bTa\b/g, "Votre")
    .replace(/\bta\b/g, "votre")
    .replace(/\bTon\b/g, "Votre")
    .replace(/\bton\b/g, "votre")
    .replace(/\bTu\b/g, "Vous")
    .replace(/\btu\b/g, "vous");
}

async function translateGoogle(text) {
  const url = new URL("https://translate.googleapis.com/translate_a/single");
  url.searchParams.set("client", "gtx");
  url.searchParams.set("sl", "en");
  url.searchParams.set("tl", "fr");
  url.searchParams.set("dt", "t");
  url.searchParams.set("q", text);
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) throw new Error(`translate HTTP ${res.status}`);
      const data = await res.json();
      return data[0].map((p) => p[0]).join("");
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function translateOne(en) {
  if (en in OVERRIDES) return OVERRIDES[en];
  const { out, map } = protect(en);
  let frText = polishVous(unprotect(await translateGoogle(out), map));
  return frText;
}

async function poolMap(items, fn, n) {
  const out = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try {
        out[i] = [items[i], await fn(items[i])];
      } catch (e) {
        console.error(`fail: ${items[i].slice(0, 50)}… ${e.message}`);
        out[i] = [items[i], items[i]];
      }
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

async function runBatch(batchIndex, slice) {
  const pairs = await poolMap(slice, translateOne, concurrency);
  const map = Object.fromEntries(pairs);
  const outPath = resolve(tmpDir, `batch-${batchIndex}-fr.json`);
  writeFileSync(outPath, JSON.stringify(map, null, 1) + "\n");
  console.log(`wrote ${outPath} (${Object.keys(map).length} entries)`);
}

const batches = [];
for (let i = 0; i < missing.length; i += size) {
  batches.push({ index: Math.floor(i / size), slice: missing.slice(i, i + size) });
}

const todo =
  batchOnly !== null ? batches.filter((b) => b.index === batchOnly) : batches.filter((b) => b.index * size >= from);

for (const { index, slice } of todo) {
  const out = resolve(tmpDir, `batch-${index}-fr.json`);
  if (existsSync(out) && !argv.includes("--force")) {
    console.log(`skip batch ${index} (exists, use --force)`);
    continue;
  }
  await runBatch(index, slice);
}

console.log(`done. ${missing.length} keys still missing in dict.`);