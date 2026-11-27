// Apply polish overrides to batch JSON files before merge.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { OVERRIDES } from "./polish-fr-overrides.mjs";

const tmp = resolve(dirname(fileURLToPath(import.meta.url)), "temp");
for (const name of readdirSync(tmp).filter((f) => f.endsWith("-fr.json"))) {
  const path = resolve(tmp, name);
  const map = JSON.parse(readFileSync(path, "utf8"));
  let n = 0;
  for (const [en, fr] of Object.entries(map)) {
    if (en in OVERRIDES) {
      map[en] = OVERRIDES[en];
      n++;
    }
  }
  writeFileSync(path, JSON.stringify(map, null, 1) + "\n");
  if (n) console.log(`${name}: ${n} overrides`);
}