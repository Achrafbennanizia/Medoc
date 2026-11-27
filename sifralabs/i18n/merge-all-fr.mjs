// Apply polish overrides and merge every i18n/temp/batch-*-fr.json into fr.json.
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const i18n = resolve(dirname(fileURLToPath(import.meta.url)));
const tmp = resolve(i18n, "temp");
const batches = readdirSync(tmp)
  .filter((f) => /^batch-\d+-fr\.json$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

spawnSync("node", [resolve(i18n, "apply-polish-fr.mjs")], { stdio: "inherit", cwd: resolve(i18n, "..") });
if (!batches.length) {
  console.error("No batch-*-fr.json files in i18n/temp/");
  process.exit(1);
}
const r = spawnSync(
  "node",
  [resolve(i18n, "merge-fr.mjs"), ...batches.map((f) => resolve(tmp, f))],
  { stdio: "inherit", cwd: resolve(i18n, "..") },
);
process.exit(r.status ?? 1);