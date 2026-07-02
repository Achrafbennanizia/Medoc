#!/usr/bin/env node
/**
 * Machine-translate fr/ar keys that still copy German (fr/ar[k] === de[k])
 * while English differs. Source text: en[k] when en !== de, else de[k].
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "packages/shared/locales");
const outPath = join(root, "scripts/i18n-translation-patches-de-gaps.json");

const de = JSON.parse(readFileSync(join(localesDir, "de.json"), "utf8"));
const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const fr = JSON.parse(readFileSync(join(localesDir, "fr.json"), "utf8"));
const ar = JSON.parse(readFileSync(join(localesDir, "ar.json"), "utf8"));

const existing = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf8"))
    : { fr: {}, ar: {} };

const cognate =
    /^(Patient|Dashboard|Editor|Team|OK|CSV|JSON|XML|PDF|ZIP|API|DATEV|Gematik|LAN|HTTPS|TLS|ADMIN|MEMBER|SMS|Push|Email|Recall|Mesh|Serverless|Replica|Master|MeDoc|Alt \+ [0-9].*|FA-[A-Z0-9-]+.*|—|–|\.\.\.|…|aut idem|Version|Details|Status|Scanner|Break-Glass)$/;

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
    return Object.keys(de)
        .filter((k) => {
            const dv = de[k];
            if (typeof dv !== "string" || dv.length < 2) return false;
            if (catalog[k] !== dv) return false;
            if (cognate.test(dv.trim())) return false;
            if (existing[loc][k]) return false;
            return true;
        })
        .sort();
}

function sourceText(k) {
    const ev = en[k];
    const dv = de[k];
    if (typeof ev === "string" && ev !== dv) return ev;
    return dv;
}

const limit = Number(process.env.I18N_MT_LIMIT ?? "0");
const delayMs = Number(process.env.I18N_MT_DELAY_MS ?? "350");

for (const loc of ["fr", "ar"]) {
    const keys = gapKeys(loc);
    const max = limit > 0 ? Math.min(limit, keys.length) : keys.length;
    console.log(`[i18n:de-gaps] ${loc}: ${max}/${keys.length} keys to translate`);
    let done = 0;
    for (const k of keys.slice(0, max)) {
        const source = sourceText(k);
        try {
            const translated = await translateText(source, loc);
            existing[loc][k] = translated;
            done++;
            if (done % 25 === 0) {
                writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
                console.log(`[i18n:de-gaps] ${loc}: ${done}/${max} saved`);
            }
        } catch (e) {
            console.error(`[i18n:de-gaps] ${loc} ${k} failed:`, e.message);
            writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
            break;
        }
        await sleep(delayMs);
    }
    writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
    console.log(`[i18n:de-gaps] ${loc}: done ${done}`);
}

console.log(
    `[i18n:de-gaps] wrote ${outPath} — fr ${Object.keys(existing.fr).length}, ar ${Object.keys(existing.ar).length}`,
);
