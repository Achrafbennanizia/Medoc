#!/usr/bin/env node
/**
 * Scan UI sources for hardcoded German / titleDe patterns.
 * Usage: node scripts/i18n-scan-hardcoded.mjs [--baseline]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, relative, dirname, extname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOTS = [
    "apps/practice-host-ui/src",
    "packages/app/practice-host/src",
    "packages/ui/src",
    "packages/server/lan/src",
    "packages/server/company/src",
];

const GERMAN_WORDS =
    /\b(Speichern|Abbrechen|Mitarbeiter|Löschen|Bearbeiten|Hinzufügen|Fehler|Wird geladen|Keine|Bitte|Praxis|Patienten|Termin|Verwaltung|Arbeitszeit|Krankenbescheinigung|Einfügen|einplanen|Notfall)\b/;
const UMLAUT = /[äöüßÄÖÜ]/;
const TITLE_DE = /titleDe\s*:/;
const TOAST_DE =
    /toast\s*\(\s*["'`][^"'`]*(?:[äöüßÄÖÜ]|Speichern|Abbrechen|Fehler|Bitte|Keine|Lizenz|Export|Import|Aktivierung|Pairing|Synchronisation|Audit|HTTPS|PDF|Daten)/;
const ATTR_NAMES = "(?:label|title|subtitle|placeholder|aria-label|ariaLabel)";
const ATTR_QUOTED_DE = new RegExp(
    `\\b${ATTR_NAMES}\\s*=\\s*["'\`]([^"'\`]*(?:[äöüßÄÖÜ]|Speichern|Abbrechen|Fehler|Bitte|Keine|Status|Aktion|Export|Lizenz|Patient)[^"'\`]*)["'\`]`,
);
const HAS_I18N_CALL = /\b(?:t|tp|tr|translateLocale|translateLocaleParams)\s*\(/;

const IGNORE = [
    /\.test\.(ts|tsx)$/,
    /\.smoke\.test\.(ts|tsx)$/,
    /g21-routing/,
];

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
            if (name === "node_modules" || name === "dist") continue;
            walk(p, out);
        } else if (/\.(tsx|ts)$/.test(name)) out.push(p);
    }
    return out;
}

function lineUsesI18n(line) {
    return HAS_I18N_CALL.test(line);
}

function scanFile(path) {
    if (IGNORE.some((re) => re.test(path))) return [];
    const rel = relative(root, path);
    const lines = readFileSync(path, "utf8").split("\n");
    const hits = [];
    lines.forEach((line, i) => {
        if (line.trim().startsWith("//")) return;
        if (/\bTermin[\[\]>]|Record<string,\s*Termin/.test(line)) return;
        if (lineUsesI18n(line)) return;
        if (TITLE_DE.test(line)) hits.push({ line: i + 1, kind: "titleDe", text: line.trim() });
        else if (TOAST_DE.test(line)) hits.push({ line: i + 1, kind: "toast", text: line.trim() });
        else if (ATTR_QUOTED_DE.test(line))
            hits.push({ line: i + 1, kind: "attr", text: line.trim().slice(0, 120) });
        else if (
            (UMLAUT.test(line) || GERMAN_WORDS.test(line)) &&
            (line.includes("title=") ||
                line.includes("label=") ||
                line.includes("subtitle=") ||
                line.includes("placeholder=") ||
                (line.includes(">") && line.includes("<")))
        ) {
            hits.push({ line: i + 1, kind: "german", text: line.trim().slice(0, 120) });
        }
    });
    return hits.map((h) => ({ file: rel, ...h }));
}

const allHits = [];
for (const r of SCAN_ROOTS) {
    const abs = join(root, r);
    try {
        for (const f of walk(abs)) allHits.push(...scanFile(f));
    } catch {
        /* missing dir */
    }
}

const baselinePath = join(root, "scripts/i18n-hardcoded-baseline.json");
const isBaseline = process.argv.includes("--baseline");

if (isBaseline) {
    writeFileSync(baselinePath, `${JSON.stringify(allHits, null, 2)}\n`);
    console.log(`[i18n:scan] baseline written — ${allHits.length} hits`);
    process.exit(0);
}

let baseline = [];
try {
    baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch {
    console.warn("[i18n:scan] no baseline — run with --baseline first; reporting all hits");
}

const baseSet = new Set(baseline.map((h) => `${h.file}:${h.line}:${h.kind}`));
const newHits = allHits.filter((h) => !baseSet.has(`${h.file}:${h.line}:${h.kind}`));

console.log(`[i18n:scan] total hits: ${allHits.length}, baseline: ${baseline.length}, new: ${newHits.length}`);
if (newHits.length > 0 && baseline.length > 0) {
    for (const h of newHits.slice(0, 30)) {
        console.error(`  NEW ${h.file}:${h.line} [${h.kind}] ${h.text}`);
    }
    if (newHits.length > 30) console.error(`  … and ${newHits.length - 30} more`);
    process.exit(1);
}

if (allHits.length > 0 && baseline.length === 0) {
    for (const h of allHits.slice(0, 50)) {
        console.log(`  ${h.file}:${h.line} [${h.kind}] ${h.text}`);
    }
    if (allHits.length > 50) console.log(`  … and ${allHits.length - 50} more`);
}
