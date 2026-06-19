#!/usr/bin/env node
/** Fix empty or failed translations in fr.json / ar.json. */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "packages/shared/locales");
const en = JSON.parse(readFileSync(join(outDir, "en.json"), "utf8"));

async function translateOne(text, target) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) return text;
    const data = await res.json();
    const seg = data[0];
    if (!Array.isArray(seg) || !seg[0]) return text;
    return seg.map((s) => s[0]).join("");
}

async function fixLocale(file, target) {
    const path = join(outDir, file);
    const cat = JSON.parse(readFileSync(path, "utf8"));
    let fixed = 0;
    for (const [k, v] of Object.entries(cat)) {
        if (!v || String(v).trim() === "") {
            cat[k] = await translateOne(en[k] ?? k, target);
            if (!cat[k] || String(cat[k]).trim() === "") cat[k] = en[k] ?? k;
            fixed++;
            await new Promise((r) => setTimeout(r, 100));
        }
    }
    writeFileSync(path, `${JSON.stringify(cat, null, 2)}\n`);
    console.log(`Fixed ${fixed} empty entries in ${file}`);
}

await fixLocale("fr.json", "fr");
await fixLocale("ar.json", "ar");

// Ensure Arabic critical keys
const ar = JSON.parse(readFileSync(join(outDir, "ar.json"), "utf8"));
const critical = {
    "nav.einstellungen": "الإعدادات",
    "nav.patienten": "ملفات المرضى",
    "auth.login": "تسجيل الدخول",
    "auth.logout": "تسجيل الخروج",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
};
Object.assign(ar, critical);
writeFileSync(join(outDir, "ar.json"), `${JSON.stringify(ar, null, 2)}\n`);
console.log("Applied Arabic critical overrides");
