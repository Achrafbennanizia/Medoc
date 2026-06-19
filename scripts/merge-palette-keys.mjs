#!/usr/bin/env node
/** Merge palette.cmd.* keys from git HEAD command-palette-data + extras into all locale JSON. */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gitSrc = execSync("git show HEAD:packages/shared/src/lib/command-palette-data.ts", { cwd: root }).toString();
const re = /id:\s*"([^"]+)"[^}]*titleDe:\s*"((?:\\.|[^"\\])*)"/g;
const paletteDe = {};
let m;
while ((m = re.exec(gitSrc)) !== null) {
    paletteDe[`palette.cmd.${m[1]}`] = m[2].replace(/\\"/g, '"');
}
paletteDe["palette.cmd.personal-arbeitszeit"] = "Arbeitszeit (Personal)";
paletteDe["palette.cmd.verwaltung-team-arbeitszeit"] = "Team-Arbeitszeit (Verwaltung)";

const paletteEn = {
    "palette.cmd.dash": "Overview & Dashboard",
    "palette.cmd.termine": "Appointments",
    "palette.cmd.termine-neu": "New appointment",
    "palette.cmd.patienten": "Patient records",
    "palette.cmd.patienten-neu": "New patient",
    "palette.cmd.akten-zu-validieren": "Records to validate",
    "palette.cmd.praxis-tickets": "Practice tickets",
    "palette.cmd.finanzen": "Finances",
    "palette.cmd.finanzen-kasse": "Cash receipts",
    "palette.cmd.finanzen-neu": "New payment",
    "palette.cmd.finanzen-kasse-neu": "New payment (cash receipts)",
    "palette.cmd.bestellungen": "Orders",
    "palette.cmd.bestellungen-neu": "New order",
    "palette.cmd.bilanz": "Balance sheet",
    "palette.cmd.bilanz-neu": "New balance sheet (wizard)",
    "palette.cmd.verwaltung": "Administration (overview)",
    "palette.cmd.verwaltung-arbeitstage": "Work days & leave",
    "palette.cmd.verwaltung-praxisplanung": "Practice planning",
    "palette.cmd.verwaltung-arbeitszeiten": "Working hours",
    "palette.cmd.verwaltung-sonder-sperrzeiten": "Special blocked times",
    "palette.cmd.verwaltung-praeferenzen": "Practice preferences",
    "palette.cmd.verwaltung-vorlagen": "Prescription & certificate templates",
    "palette.cmd.verwaltung-vorlagen-editor": "Template editor (redirect)",
    "palette.cmd.verwaltung-behandlungs-katalog": "Treatment catalog (services)",
    "palette.cmd.verwaltung-bestellstamm": "Order master data (supplier / contact)",
    "palette.cmd.verwaltung-finanzen-berichte": "Finance & reports (admin)",
    "palette.cmd.verwaltung-team": "Team (admin)",
    "palette.cmd.verwaltung-lager-bestellwesen": "Stock, products & ordering (admin)",
    "palette.cmd.verwaltung-vertraege": "Contracts (costs / expenses)",
    "palette.cmd.verwaltung-leistungen-kataloge-vorlagen": "Services, catalogs & templates (admin)",
    "palette.cmd.verwaltung-tagesabschluss": "Daily close (finance & reports)",
    "palette.cmd.verwaltung-finanz-werkzeuge": "Invoice (PDF) (finance & reports)",
    "palette.cmd.rezepte": "Prescriptions",
    "palette.cmd.atteste": "Certificates",
    "palette.cmd.leistungen": "Services",
    "palette.cmd.leistungen-neu": "New service",
    "palette.cmd.produkte": "Products & stock",
    "palette.cmd.personal": "Staff (via admin)",
    "palette.cmd.personal-arbeitsplan": "Shift plan & assignments (staff)",
    "palette.cmd.personal-arbeitszeit": "Work time (staff)",
    "palette.cmd.verwaltung-team-arbeitszeit": "Team work time (admin)",
    "palette.cmd.personal-neu": "New staff member",
    "palette.cmd.statistik": "Statistics",
    "palette.cmd.audit": "Audit log",
    "palette.cmd.datenschutz": "Privacy & GDPR",
    "palette.cmd.einstellungen": "Settings",
    "palette.cmd.logs": "System logs",
    "palette.cmd.ops": "Operations & backup",
    "palette.cmd.compliance": "Compliance",
    "palette.cmd.hilfe": "Help & shortcuts",
    "palette.cmd.feedback": "Feedback & vigilance",
    "palette.cmd.migration": "Data migration (wizard)",
};

const extra = {
    de: {
        "palette.title": "Suche & Schnellzugriff",
        "palette.search_label": "Seiten und Aktionen durchsuchen",
        "palette.hits_aria": "Treffer",
        "palette.hint": "Navigation · Enter öffnen · Esc schließen",
        "breadcrumb.app": "MeDoc",
        "breadcrumb.dashboard": "Dashboard",
        "breadcrumb.editor": "Editor",
        "breadcrumb.edit": "Bearbeiten",
        "breadcrumb.new_task": "Neue Aufgabe",
        "breadcrumb.new_prescription": "Neues Rezept",
        "breadcrumb.edit_prescription": "Rezept bearbeiten",
        "breadcrumb.record": "Akte",
        "breadcrumb.work_days": "Arbeitstage",
        "breadcrumb.templates": "Vorlagen",
        "breadcrumb.treatment_catalog": "Behandlungskatalog",
        "breadcrumb.order_master": "Bestell-Stammdaten",
        "breadcrumb.finance_reports": "Finanzen & Berichte",
        "breadcrumb.team": "Team",
        "breadcrumb.work_time": "Arbeitszeit",
        "breadcrumb.sick_cert": "Krankenbescheinigung",
        "breadcrumb.daily_close": "Tagesabschluss",
        "breadcrumb.invoice_pdf": "Rechnung (PDF)",
        "breadcrumb.stock_orders": "Lager, Produkte & Bestellwesen",
        "breadcrumb.contracts": "Verträge",
        "breadcrumb.services_catalogs": "Leistungen, Kataloge & Vorlagen",
        "breadcrumb.shift_plan": "Arbeitsplan & Einsätze",
        "a11y.close": "Schließen",
        "a11y.pick_time": "Uhrzeit wählen",
        "a11y.remove_tag": "{tag} entfernen",
        "a11y.dialog_actions": "Aktionen",
    },
    en: {
        "palette.title": "Search & quick access",
        "palette.search_label": "Search pages and actions",
        "palette.hits_aria": "Results",
        "palette.hint": "Navigate · Enter to open · Esc to close",
        "breadcrumb.app": "MeDoc",
        "breadcrumb.dashboard": "Dashboard",
        "breadcrumb.editor": "Editor",
        "breadcrumb.edit": "Edit",
        "breadcrumb.new_task": "New task",
        "breadcrumb.new_prescription": "New prescription",
        "breadcrumb.edit_prescription": "Edit prescription",
        "breadcrumb.record": "Record",
        "breadcrumb.work_days": "Work days",
        "breadcrumb.templates": "Templates",
        "breadcrumb.treatment_catalog": "Treatment catalog",
        "breadcrumb.order_master": "Order master data",
        "breadcrumb.finance_reports": "Finance & reports",
        "breadcrumb.team": "Team",
        "breadcrumb.work_time": "Work time",
        "breadcrumb.sick_cert": "Sick certificate",
        "breadcrumb.daily_close": "Daily close",
        "breadcrumb.invoice_pdf": "Invoice (PDF)",
        "breadcrumb.stock_orders": "Stock, products & ordering",
        "breadcrumb.contracts": "Contracts",
        "breadcrumb.services_catalogs": "Services, catalogs & templates",
        "breadcrumb.shift_plan": "Shift plan & assignments",
        "a11y.close": "Close",
        "a11y.pick_time": "Pick a time",
        "a11y.remove_tag": "Remove {tag}",
        "a11y.dialog_actions": "Actions",
    },
};

const localesDir = join(root, "packages/shared/locales");
for (const loc of ["de", "en", "fr", "ar"]) {
    const path = join(localesDir, `${loc}.json`);
    const cat = JSON.parse(readFileSync(path, "utf8"));
    if (loc === "de") {
        Object.assign(cat, paletteDe, extra.de);
    } else if (loc === "en") {
        Object.assign(cat, paletteEn, extra.en);
    } else {
        const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));
        for (const k of [...Object.keys(paletteDe), ...Object.keys(paletteEn), ...Object.keys(extra.en)]) {
            if (!(k in cat)) cat[k] = en[k];
        }
    }
    const sorted = Object.fromEntries(Object.keys(cat).sort().map((k) => [k, cat[k]]));
    writeFileSync(path, `${JSON.stringify(sorted, null, 2)}\n`);
}
console.log(`Merged ${Object.keys(paletteDe).length} palette.cmd keys + extras into 4 locales`);
