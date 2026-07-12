#!/usr/bin/env node
/** Machine-translate pass-5 gap keys (fr/ar audit) from updated English catalog. */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "packages/shared/locales");
const audit = JSON.parse(readFileSync(join(root, "scripts/i18n-untranslated-audit.json"), "utf8"));

const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
const fr = JSON.parse(readFileSync(join(localesDir, "fr.json"), "utf8"));
const ar = JSON.parse(readFileSync(join(localesDir, "ar.json"), "utf8"));

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
    });
    return s;
}

async function translateText(text, target) {
    const { s, tokens } = protectPlaceholders(text);
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(s)}&langpair=en|${target}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.quotaFinished) throw new Error("MyMemory quota finished");
    return restorePlaceholders(data.responseData?.translatedText ?? s, tokens);
}

const EXTRA = {
    fr: {
        "untersuchung.composer.bop_ph": "p. ex. 18",
        "untersuchung.composer.bruxism": "Bruxisme / parafonction",
        "untersuchung.composer.cmd": "Constats CMD",
        "untersuchung.composer.diagnosis_ph": "p. ex. K02.1 carie dentinaire rég. 36 distal",
        "untersuchung.composer.gingiva": "Gingive (consistance / couleur)",
        "untersuchung.composer.hygiene": "Hygiène bucco-dentaire",
        "untersuchung.composer.hygiene_ph": "bon / moyen / mauvais",
        "untersuchung.composer.imaging_note": "Note radiologie / compte rendu",
        "untersuchung.composer.imaging_ordered_ph": "p. ex. OPG, rétro-alvéolaire, statut PA",
        "untersuchung.composer.lymph": "Ganglions lymphatiques (cervico-faciaux)",
        "untersuchung.composer.mucosa": "Muqueuse buccale",
        "untersuchung.composer.muscles": "Muscles (masséter / temporal)",
        "untersuchung.composer.pain_location": "Localisation",
        "untersuchung.composer.pain_location_ph": "p. ex. rég. 36 quadrant III",
        "untersuchung.composer.pain_location_prefix": "Localisation : {location}",
        "untersuchung.composer.pain_vas": "Douleur (EVA 0–10)",
        "untersuchung.composer.pain_vas_prefix": "Douleur EVA {vas}/10",
        "untersuchung.composer.psi_0": "0 (sain)",
        "untersuchung.composer.psi_2": "2 (calculs)",
        "untersuchung.composer.psi_3": "3 (profondeur de poche 4–5 mm)",
        "untersuchung.composer.psi_4": "4 (profondeur de poche ≥ 6 mm)",
        "untersuchung.composer.psi_hint": "IPS par sextant (S1 17–14, S2 13–23, S3 24–27, S4 47–44, S5 43–33, S6 34–37).",
        "untersuchung.composer.psi_star": "* constat (furcation/récession)",
        "untersuchung.composer.salivary": "Glandes salivaires / flux salivaire",
        "untersuchung.composer.section_diag": "Diagnostic et plan",
        "untersuchung.composer.section_funk": "Fonction",
        "untersuchung.composer.section_hart": "Constats dentaires",
        "untersuchung.composer.section_haupt": "Motif de consultation",
        "untersuchung.composer.splint": "Gouttière / rééducation",
        "untersuchung.composer.tmj": "Articulation temporo-mandibulaire (ATM)",
        "praxis.aufgaben.status.offen": "Ouvert",
        "praxis.aufgaben.status.validiert": "Validé",
        "praxis.aufgaben.typ.druck": "Impression",
        "page.bestellung.create.unit_ph": "p. ex. pièce, colis",
    },
    ar: {
        "untersuchung.composer.bop_ph": "مثال: 18",
        "untersuchung.composer.bruxism": "صرير الأسنان / وظيفة شاذة",
        "untersuchung.composer.cmd": "نتائج اضطرابات مفصل الفك",
        "untersuchung.composer.diagnosis_ph": "مثال: K02.1 تسوس العاج منطقة 36 وجهي",
        "untersuchung.composer.gingiva": "اللثة (القوام / اللون)",
        "untersuchung.composer.hygiene": "نظافة الفم",
        "untersuchung.composer.hygiene_ph": "جيد / متوسط / ضعيف",
        "untersuchung.composer.imaging_note": "ملاحظة الأشعة / النتائج",
        "untersuchung.composer.imaging_ordered_ph": "مثال: بانوراما، أشعة جانبية، حالة PA",
        "untersuchung.composer.lymph": "العقد اللمفاوية (عنق-وجه)",
        "untersuchung.composer.mucosa": "غشاء الفم",
        "untersuchung.composer.muscles": "العضلات (الماضغة / الصدغية)",
        "untersuchung.composer.pain_location": "الموقع",
        "untersuchung.composer.pain_location_ph": "مثال: منطقة 36 الربع III",
        "untersuchung.composer.pain_location_prefix": "الموقع: {location}",
        "untersuchung.composer.pain_vas": "الألم (مقياس 0–10)",
        "untersuchung.composer.pain_vas_prefix": "ألم مقياس {vas}/10",
        "untersuchung.composer.psi_0": "0 (سليم)",
        "untersuchung.composer.psi_2": "2 (جير)",
        "untersuchung.composer.psi_3": "3 (عمق جيب 4–5 مم)",
        "untersuchung.composer.psi_4": "4 (عمق جيب ≥ 6 مم)",
        "untersuchung.composer.psi_hint": "مؤشر IPS لكل سداسي (S1 17–14، S2 13–23، S3 24–27، S4 47–44، S5 43–33، S6 34–37).",
        "untersuchung.composer.psi_star": "* نتيجة (تفرع/انحسار)",
        "untersuchung.composer.salivary": "الغدد اللعابية / تدفق اللعاب",
        "untersuchung.composer.section_diag": "التشخيص والخطة",
        "untersuchung.composer.section_funk": "الوظيفة",
        "untersuchung.composer.section_hart": "النتائج السنية",
        "untersuchung.composer.section_haupt": "الشكوى الرئيسية",
        "untersuchung.composer.splint": "واقي / إعادة تأهيل",
        "untersuchung.composer.tmj": "مفصل الفك الصدغي",
        "page.bestellung.create.unit_ph": "مثال: قطعة، عبوة",
    },
};

const delayMs = Number(process.env.I18N_MT_DELAY_MS ?? "350");

for (const loc of ["fr", "ar"]) {
    const catalog = loc === "fr" ? fr : ar;
    const keys = [...new Set([...(audit[loc] ?? []).map((x) => x.k), ...Object.keys(EXTRA[loc] ?? {})])];
    let applied = 0;
    let done = 0;
    for (const k of keys) {
        if (EXTRA[loc]?.[k]) {
            catalog[k] = EXTRA[loc][k];
            applied++;
            continue;
        }
        const source = en[k];
        if (!source || typeof source !== "string") continue;
        try {
            catalog[k] = await translateText(source, loc);
            applied++;
            done++;
            if (done % 20 === 0) console.log(`[i18n:pass5-${loc}] ${done}/${keys.length}`);
        } catch (e) {
            console.error(`[i18n:pass5-${loc}] stopped at ${k}:`, e.message);
            break;
        }
        await sleep(delayMs);
    }
    const sorted = Object.fromEntries(Object.keys(catalog).sort().map((key) => [key, catalog[key]]));
    writeFileSync(join(localesDir, `${loc}.json`), `${JSON.stringify(sorted, null, 2)}\n`);
    console.log(`[i18n:pass5-${loc}] ${loc}.json — ${applied} values updated`);
}
