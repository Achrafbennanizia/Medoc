#!/usr/bin/env node
/** Merge scripts/i18n-translation-patches.json into locale catalogs. */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "packages/shared/locales");
const patches = JSON.parse(readFileSync(join(root, "scripts/i18n-translation-patches.json"), "utf8"));
const pass3 = JSON.parse(readFileSync(join(root, "scripts/i18n-translation-patches-pass3.json"), "utf8"));
const pass4Priority = JSON.parse(
    readFileSync(join(root, "scripts/i18n-translation-patches-pass4-priority.json"), "utf8"),
);
let pass4 = {};
try {
    pass4 = JSON.parse(readFileSync(join(root, "scripts/i18n-translation-patches-pass4.json"), "utf8"));
} catch {
    /* pass4 generated asynchronously */
}
let pass4Machine = {};
try {
    pass4Machine = JSON.parse(readFileSync(join(root, "scripts/i18n-translation-patches-pass4-machine.json"), "utf8"));
} catch {
    /* optional machine translations */
}
for (const i of [1, 2, 3, 4]) {
    try {
        const chunk = JSON.parse(
            readFileSync(join(root, `scripts/i18n-translation-patches-pass4-chunk${i}.json`), "utf8"),
        );
        pass4.fr = { ...pass4.fr, ...(chunk.fr ?? {}) };
        pass4.ar = { ...pass4.ar, ...(chunk.ar ?? {}) };
    } catch {
        /* chunk optional */
    }
}

for (const loc of ["en", "fr", "ar"]) {
    const path = join(localesDir, `${loc}.json`);
    const catalog = JSON.parse(readFileSync(path, "utf8"));
    const patch = {
        ...(patches[loc] ?? {}),
        ...(pass3[loc] ?? {}),
        ...(pass4Priority[loc] ?? {}),
        ...(pass4[loc] ?? {}),
        ...(pass4Machine[loc] ?? {}),
    };
    let applied = 0;
    for (const [k, v] of Object.entries(patch)) {
        if (catalog[k] !== v) {
            catalog[k] = v;
            applied++;
        }
    }
    const sorted = Object.fromEntries(Object.keys(catalog).sort().map((k) => [k, catalog[k]]));
    writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`[i18n:apply] ${loc}.json — ${applied} values updated`);
}
