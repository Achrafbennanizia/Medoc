#!/usr/bin/env node
/** One-time / maintenance: extract locale blocks from i18n.ts into JSON catalogs. */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcPath = join(root, "packages/shared/src/lib/i18n.ts");
const src = readFileSync(srcPath, "utf8");

function parseLocaleBlock(source, locale) {
    const startMarker = `${locale}: {`;
    const start = source.indexOf(startMarker);
    if (start < 0) throw new Error(`locale block not found: ${locale}`);
    let i = start + startMarker.length;
    let depth = 1;
    const begin = i;
    while (i < source.length && depth > 0) {
        const ch = source[i];
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
        i++;
    }
    const block = source.slice(begin, i - 1);
    const out = {};
    const keyRe = /"((?:\\.|[^"\\])*)"\s*:\s*/g;
    let m;
    while ((m = keyRe.exec(block)) !== null) {
        const key = m[1].replace(/\\"/g, '"');
        let pos = m.index + m[0].length;
        while (pos < block.length && /\s/.test(block[pos])) pos++;
        if (block[pos] !== '"') continue;
        pos++;
        let value = "";
        while (pos < block.length) {
            const c = block[pos];
            if (c === "\\") {
                const next = block[pos + 1];
                if (next === "n") value += "\n";
                else if (next === '"') value += '"';
                else if (next === "\\") value += "\\";
                else value += next ?? "";
                pos += 2;
                continue;
            }
            if (c === '"') {
                pos++;
                break;
            }
            value += c;
            pos++;
        }
        out[key] = value;
        keyRe.lastIndex = pos;
    }
    return out;
}

const de = parseLocaleBlock(src, "de");
const en = parseLocaleBlock(src, "en");
const outDir = join(root, "packages/shared/locales");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "de.json"), `${JSON.stringify(de, null, 2)}\n`);
writeFileSync(join(outDir, "en.json"), `${JSON.stringify(en, null, 2)}\n`);
console.log(`Wrote de.json (${Object.keys(de).length} keys), en.json (${Object.keys(en).length} keys)`);
