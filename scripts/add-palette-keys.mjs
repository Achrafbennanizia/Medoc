#!/usr/bin/env node
/** Add palette.* keys from command-palette-data titleDe to all locale JSON files. */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = join(root, "packages/shared/src/lib/command-palette-data.ts");
const src = readFileSync(dataPath, "utf8");
const re = /id:\s*"([^"]+)"[^}]*titleDe:\s*"((?:\\.|[^"\\])*)"/g;
const paletteDe = {};
let m;
while ((m = re.exec(src)) !== null) {
    paletteDe[`palette.cmd.${m[1]}`] = m[2].replace(/\\"/g, '"');
}

const localesDir = join(root, "packages/shared/locales");
for (const loc of ["de", "en", "fr", "ar"]) {
    const path = join(localesDir, `${loc}.json`);
    const cat = JSON.parse(readFileSync(path, "utf8"));
    if (loc === "de") {
        Object.assign(cat, paletteDe);
    } else {
        // keep existing translations; add missing palette keys from en
        const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
        for (const [k, deVal] of Object.entries(paletteDe)) {
            if (!(k in cat)) cat[k] = en[k] ?? deVal;
        }
    }
    writeFileSync(path, `${JSON.stringify(cat, null, 2)}\n`);
}
console.log(`Added ${Object.keys(paletteDe).length} palette.cmd.* keys`);
