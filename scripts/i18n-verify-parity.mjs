#!/usr/bin/env node
/** Fail CI when locale JSON catalogs diverge or contain untranslated values. */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const localesDir = join(root, "packages/shared/locales");
const LOCALES = ["de", "en", "fr", "ar"];

const catalogs = Object.fromEntries(
    LOCALES.map((loc) => {
        const data = JSON.parse(readFileSync(join(localesDir, `${loc}.json`), "utf8"));
        return [loc, data];
    }),
);

const deKeys = Object.keys(catalogs.de).sort();
let failed = false;

for (const loc of LOCALES) {
    const keys = Object.keys(catalogs[loc]).sort();
    if (keys.length !== deKeys.length) {
        console.error(`[i18n] ${loc}.json has ${keys.length} keys, expected ${deKeys.length}`);
        failed = true;
    }
    for (const k of deKeys) {
        if (!(k in catalogs[loc])) {
            console.error(`[i18n] missing key in ${loc}.json: ${k}`);
            failed = true;
        }
    }
}

for (const loc of LOCALES) {
    for (const k of deKeys) {
        const v = catalogs[loc][k];
        if (v === k) {
            console.error(`[i18n] untranslated value equals key in ${loc}.json: ${k}`);
            failed = true;
        }
        if (!v || String(v).trim() === "") {
            console.error(`[i18n] empty value in ${loc}.json: ${k}`);
            failed = true;
        }
    }
}

const AR_CRITICAL = [
    "nav.settings",
    "nav.patienten",
    "auth.login",
    "auth.logout",
    "common.save",
    "common.cancel",
];
const arabicRe = /[\u0600-\u06FF]/;
for (const k of AR_CRITICAL) {
    if (!arabicRe.test(catalogs.ar[k] ?? "")) {
        console.error(`[i18n] ar.json critical key lacks Arabic script: ${k} => ${catalogs.ar[k]}`);
        failed = true;
    }
}

/** German markers in non-de catalogs — only flag clear leftovers, not English cognates. */
const UMLAUT = /[äöüßÄÖÜ]/;
const DE_SPECIFIC =
    /\b(und|für|mit|wird|keine|Bitte|Speichern|Abbrechen|Patienten|Praxis|Verwaltung|Bearbeiten|Löschen|geladen|fehlgeschlagen|Hinweis|Begründung|Pflicht|Freigabe|Bestätigen|Stornieren|Lieferant|Bestellung|Quittung|Abrechnung|Katalog|Vorlage|Merkblatt|Entlassung|Nachsorge|Untersuchung|Behandlung|Anamnese|Versicherung|Kranken|Rezeption|Rezept|Attest|Akte|Speicherort|Vorschau|Dokument|Ärztin|können|müssen|sollten|wurde|wurden|nicht|eine|einer|einem|dieser|diese|dieses|erforderlich|Wiederherstellung|Spalten|Importdatei|Sprechzeiten|Wochentag|Pausenfenster|Slotdauer|vereinbaren|Stammdaten|Grunddaten|einrichten|Vorauswahl|Entwurf|unvollständig|unvollstaendig|gespeichert|Erinnerungen|Terminkalender|Bestellstammdaten|Ausgabenwirkung|offene|Arbeitszeit|unbeendet|schliessen|schließen|Rechts eine|sperren Slots|Praxis-Aufgaben|Patienten-SMS|Hinweise und|Diagnose, Performance|Dateiname|In Datei|ZIP-Archive|Verbindet sich|Offline-Warteschlange|Synchronisation abgeschlossen|Einstellung nicht)\b/i;

const OK_IDENTICAL =
    /^(MeDoc|Online|Offline|Status|Break-Glass|DATEV|DocCheck|TK-Direktabrechnung|BIC|HTML|PDF|CSV|JSON|OK|Routine|Kontrolle|Beratung|Bar|Karte|Avatar|Audit|Export|Import|Ticket|Team|Compliance|Migration|Scanner|Details|Version|Support|Desktop|Total|Email|E-Mail|Telefon|Name|Patient|Datum|Zeit|Typ|Note|Contact|Price|Amount|Quantity|Unit|Reference|Metadata|Filter|Search|Dashboard|Schedule|Overview|Cancel|Save|Edit|Delete|Close|Confirm|Add|Remove|Yes|No|All|Error|Warning|Success|Info|Loading|Active|Paused|Dringend|Bald|—|·|Termin|FA-[A-Z0-9-]+)$/i;

/** API docs keep German route segments by design. */
const API_ROUTE_KEYS = new Set(["page.lan.host.api_routes"]);

for (const loc of ["en", "fr", "ar"]) {
    let germanHits = 0;
    for (const k of deKeys) {
        if (API_ROUTE_KEYS.has(k)) continue;
        const v = String(catalogs[loc][k] ?? "");
        const dv = String(catalogs.de[k] ?? "");
        if (OK_IDENTICAL.test(v.trim())) continue;

        const sameAsDe = v === dv;
        const hasGerman = UMLAUT.test(v) || DE_SPECIFIC.test(v);
        if (!hasGerman) continue;

        if (sameAsDe && (UMLAUT.test(dv) || DE_SPECIFIC.test(dv)) && !OK_IDENTICAL.test(dv.trim())) {
            console.error(`[i18n] ${loc}.json still German (identical to de): ${k} => ${v.slice(0, 80)}`);
            failed = true;
            germanHits++;
        } else if (!sameAsDe && UMLAUT.test(v)) {
            console.error(`[i18n] ${loc}.json contains German umlauts: ${k} => ${v.slice(0, 80)}`);
            failed = true;
            germanHits++;
        }
        if (germanHits >= 25) break;
    }
}

if (failed) process.exit(1);
console.log(`[i18n] parity OK — ${deKeys.length} keys × ${LOCALES.length} locales`);
