#!/usr/bin/env node
/**
 * Machine-translate catalog gaps (fr/ar still identical to en) via MyMemory API.
 * Protects {placeholders} and {{placeholders}} during translation.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "packages/shared/locales");
const outPath = join(root, "scripts/i18n-translation-patches-pass4-machine.json");

const de = JSON.parse(readFileSync(join(localesDir, "de.json"), "utf8"));
const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const fr = JSON.parse(readFileSync(join(localesDir, "fr.json"), "utf8"));
const ar = JSON.parse(readFileSync(join(localesDir, "ar.json"), "utf8"));

const existing = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf8"))
    : { fr: {}, ar: {} };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function protectPlaceholders(text) {
    const tokens = [];
    let s = text;
    s = s.replace(/\{\{[^}]+\}\}/g, (m) => {
        tokens.push(m);
        return `__PH${tokens.length - 1}__`;
    });
    s = s.replace(/\{[^}]+\}/g, (m) => {
        tokens.push(m);
        return `__PH${tokens.length - 1}__`;
    });
    return { s, tokens };
}

function restorePlaceholders(text, tokens) {
    let s = text;
    tokens.forEach((tok, i) => {
        s = s.replaceAll(`__PH${i}__`, tok);
        s = s.replaceAll(`__ PH ${i} __`, tok);
        s = s.replaceAll(`__PH ${i}__`, tok);
    });
    return s;
}

async function translateText(text, target) {
    const { s, tokens } = protectPlaceholders(text);
    const langpair = `en|${target}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(s)}&langpair=${langpair}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.quotaFinished) throw new Error("MyMemory quota finished");
    const raw = data.responseData?.translatedText ?? s;
    return restorePlaceholders(raw, tokens);
}

function gapKeys(loc) {
    const catalog = loc === "fr" ? fr : ar;
    return Object.keys(en)
        .filter((k) => {
            const ev = en[k];
            if (typeof ev !== "string" || ev.length < 2) return false;
            if (ev === de[k]) return false;
            if (catalog[k] !== ev) return false;
            if (existing[loc][k]) return false;
            return true;
        })
        .sort();
}

const limit = Number(process.env.I18N_MT_LIMIT ?? "0");
const delayMs = Number(process.env.I18N_MT_DELAY_MS ?? "400");

for (const loc of ["fr", "ar"]) {
    const keys = gapKeys(loc);
    const max = limit > 0 ? Math.min(limit, keys.length) : keys.length;
    console.log(`[i18n:mt] ${loc}: ${max}/${keys.length} keys to translate`);
    let done = 0;
    for (const k of keys.slice(0, max)) {
        const source = en[k];
        try {
            const translated = await translateText(source, loc);
            existing[loc][k] = translated;
            done++;
            if (done % 25 === 0) {
                writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
                console.log(`[i18n:mt] ${loc}: ${done}/${max} saved`);
            }
        } catch (e) {
            console.error(`[i18n:mt] ${loc} ${k} failed:`, e.message);
            writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
            break;
        }
        await sleep(delayMs);
    }
    writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
    console.log(`[i18n:mt] ${loc}: done ${done}`);
}

console.log(`[i18n:mt] wrote ${outPath} — fr ${Object.keys(existing.fr).length}, ar ${Object.keys(existing.ar).length}`);
