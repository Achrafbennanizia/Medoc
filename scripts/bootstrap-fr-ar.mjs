#!/usr/bin/env node
/** Bootstrap fr.json and ar.json from en.json via Google Translate (batch). */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const en = JSON.parse(readFileSync(join(root, "packages/shared/locales/en.json"), "utf8"));
const outDir = join(root, "packages/shared/locales");

const MANUAL_FR = {
    "app.title": "MeDoc — Gestion de cabinet",
    "nav.arbeitszeit": "Temps de travail",
};
const MANUAL_AR = {
    "app.title": "ميدوك — إدارة العيادة",
    "nav.arbeitszeit": "وقت العمل",
};

async function translateBatch(texts, target) {
    const results = [];
    const chunkSize = 40;
    for (let i = 0; i < texts.length; i += chunkSize) {
        const chunk = texts.slice(i, i + chunkSize);
        const q = chunk.map((t) => encodeURIComponent(t)).join("&q=");
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${chunk.map((t) => encodeURIComponent(t)).join("&q=")}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`translate ${target} failed: ${res.status}`);
        const data = await res.json();
        for (let j = 0; j < chunk.length; j++) {
            const seg = data[j];
            results.push(Array.isArray(seg) ? seg.map((s) => s[0]).join("") : chunk[j]);
        }
        await new Promise((r) => setTimeout(r, 200));
    }
    return results;
}

async function buildLocale(target, manual) {
    const keys = Object.keys(en);
    const values = keys.map((k) => manual[k] ?? en[k]);
    const toTranslate = keys.map((k, i) => (manual[k] ? null : values[i]));
    const indices = toTranslate.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
    const texts = indices.map((i) => en[keys[i]]);
    console.log(`Translating ${texts.length} strings to ${target}…`);
    const translated = texts.length ? await translateBatch(texts, target) : [];
    const out = {};
    let ti = 0;
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (manual[k]) out[k] = manual[k];
        else {
            out[k] = translated[ti] ?? en[k];
            ti++;
        }
    }
    return out;
}

const fr = await buildLocale("fr", MANUAL_FR);
const ar = await buildLocale("ar", MANUAL_AR);
writeFileSync(join(outDir, "fr.json"), `${JSON.stringify(fr, null, 2)}\n`);
writeFileSync(join(outDir, "ar.json"), `${JSON.stringify(ar, null, 2)}\n`);
console.log("Wrote fr.json and ar.json");
