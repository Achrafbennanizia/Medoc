// Lists the English segments each dictionary still lacks: node i18n/extract.mjs [lang]
// Writes i18n/missing-<lang>.json (English → "") to fill in, then merge into i18n/<lang>.json.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { LANGS, PAGES, includes, loadDict, segments } from "./build.mjs";

const root = resolve(import.meta.dirname, "..");
const all = [];
for (const file of PAGES) for (const s of segments(includes(readFileSync(resolve(root, file), "utf8"), root))) if (!all.includes(s)) all.push(s);

for (const lang of process.argv[2] ? [process.argv[2]] : LANGS.filter((l) => l !== "en")) {
  const dict = loadDict(root, lang);
  const missing = all.filter((s) => !(s in dict));
  writeFileSync(resolve(root, "i18n", `missing-${lang}.json`), JSON.stringify(Object.fromEntries(missing.map((s) => [s, ""])), null, 2) + "\n");
  console.log(`${lang}: ${all.length} segments, ${missing.length} missing`);
}
