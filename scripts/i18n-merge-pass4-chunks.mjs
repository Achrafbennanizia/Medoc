#!/usr/bin/env node
/** Merge pass4 chunk files into pass4.json and apply to locale catalogs. */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const merged = { fr: {}, ar: {} };

for (let i = 1; i <= 4; i++) {
    const path = join(root, `scripts/i18n-translation-patches-pass4-chunk${i}.json`);
    if (!existsSync(path)) {
        console.warn(`[i18n:merge] missing ${path}`);
        continue;
    }
    const chunk = JSON.parse(readFileSync(path, "utf8"));
    Object.assign(merged.fr, chunk.fr ?? {});
    Object.assign(merged.ar, chunk.ar ?? {});
    console.log(`[i18n:merge] chunk${i}: fr ${Object.keys(chunk.fr ?? {}).length}, ar ${Object.keys(chunk.ar ?? {}).length}`);
}

writeFileSync(join(root, "scripts/i18n-translation-patches-pass4.json"), `${JSON.stringify(merged, null, 2)}\n`);
console.log(`[i18n:merge] pass4.json — fr ${Object.keys(merged.fr).length}, ar ${Object.keys(merged.ar).length}`);
