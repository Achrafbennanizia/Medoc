#!/usr/bin/env node
/** Apply scripts/i18n-translation-patches-de-gaps.json to fr.json and ar.json. */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "packages/shared/locales");
const patchPath = join(root, "scripts/i18n-translation-patches-de-gaps.json");

if (!existsSync(patchPath)) {
    console.error("[i18n:apply-de-gaps] missing", patchPath);
    process.exit(1);
}

const patches = JSON.parse(readFileSync(patchPath, "utf8"));

for (const loc of ["fr", "ar"]) {
    const path = join(localesDir, `${loc}.json`);
    const catalog = JSON.parse(readFileSync(path, "utf8"));
    const patch = patches[loc] ?? {};
    let applied = 0;
    for (const [k, v] of Object.entries(patch)) {
        if (catalog[k] !== v) {
            catalog[k] = v;
            applied++;
        }
    }
    const sorted = Object.fromEntries(Object.keys(catalog).sort().map((k) => [k, catalog[k]]));
    writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`[i18n:apply-de-gaps] ${loc}.json — ${applied} values updated`);
}
