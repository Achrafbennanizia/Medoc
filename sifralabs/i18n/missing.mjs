// Lists the English text segments that a language dictionary does not translate yet, and the
// dictionary keys no page uses any more.
//   node i18n/missing.mjs            → writes i18n/missing-fr.json, i18n/missing-ar.json (gitignored)
// Each file: { "missing": ["English segment", …], "unused": ["key no page uses", …] }
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LANGS, PAGES, includes, loadDict, segments } from "./build.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const all = [];
for (const page of [...PAGES, "404.html"]) {
  for (const s of segments(includes(readFileSync(resolve(root, page), "utf8"), root))) {
    if (!all.includes(s)) all.push(s);
  }
}
for (const lang of LANGS.filter((l) => l !== "en")) {
  const dict = loadDict(root, lang);
  const missing = all.filter((s) => dict[s] === undefined);
  const unused = Object.keys(dict).filter((k) => !all.includes(k));
  writeFileSync(resolve(root, "i18n", `missing-${lang}.json`), JSON.stringify({ missing, unused }, null, 1) + "\n");
  console.log(`${lang}: ${missing.length} missing, ${unused.length} unused`);
}
