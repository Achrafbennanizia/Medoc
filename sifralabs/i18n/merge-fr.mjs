// Merge French translation maps into i18n/fr.json (existing keys are kept).
// Usage: node i18n/merge-fr.mjs i18n/temp/batch-0-fr.json [more …]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const frPath = resolve(root, "i18n", "fr.json");

const fr = JSON.parse(readFileSync(frPath, "utf8"));
const files = process.argv.slice(2);
if (!files.length) {
  console.error("Usage: node i18n/merge-fr.mjs <map.json> …");
  process.exit(1);
}

let added = 0;
let skipped = 0;
for (const file of files) {
  const path = resolve(process.cwd(), file);
  const batch = JSON.parse(readFileSync(path, "utf8"));
  for (const [en, frText] of Object.entries(batch)) {
    if (!frText || typeof frText !== "string") continue;
    if (en in fr) {
      skipped++;
      continue;
    }
    fr[en] = frText;
    added++;
  }
}

const sorted = Object.fromEntries(Object.keys(fr).sort((a, b) => a.localeCompare(b)).map((k) => [k, fr[k]]));
writeFileSync(frPath, JSON.stringify(sorted, null, 1) + "\n");
console.log(`merged: +${added} new, ${skipped} skipped (already in fr.json), total ${Object.keys(sorted).length}`);