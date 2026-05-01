import { routeChildPathAllowed } from "./rbac";

/**
 * Static routes wired to {@link ROUTE_VISIBILITY} keys (must match `App.tsx`).
 * e.g. `verwaltung/vorlagen` is gated by `vorlagen.read`, not `personal.read`.
 */
export type PaletteCommand = {
    id: string;
    routePath: string;
    href: string;
    /** German label for search + display */
    titleDe: string;
    keywords: string[];
};

export const PALETTE_COMMANDS: PaletteCommand[] = [
    { id: "dash", routePath: "", href: "/", titleDe: "Übersicht & Dashboard", keywords: ["home", "start"] },
    { id: "termine", routePath: "termine", href: "/termine", titleDe: "Terminübersicht", keywords: ["kalender", "termin", "appointment", "patientenakte", "übersicht"] },
    { id: "termine-neu", routePath: "termine/neu", href: "/termine/neu", titleDe: "Neuer Termin", keywords: ["anlegen", "termin neu", "buchung"] },
    { id: "patienten", routePath: "patienten", href: "/patienten", titleDe: "Patientenakten", keywords: ["akte", "patient", "patientenakte", "stammdaten"] },
    { id: "patienten-neu", routePath: "patienten/neu", href: "/patienten/neu", titleDe: "Neuer Patient", keywords: ["anlegen", "neu"] },
    { id: "finanzen", routePath: "finanzen", href: "/finanzen", titleDe: "Finanzen", keywords: ["geld", "kasse"] },
    {
        id: "finanzen-neu",
        routePath: "finanzen/neu",
        href: "/finanzen/neu",
        titleDe: "Neue Zahlung",
        keywords: ["anlegen", "einnahme", "buchung", "kasse", "zahlung"],
    },
    { id: "bestellungen", routePath: "bestellungen", href: "/bestellungen", titleDe: "Bestellungen", keywords: ["lieferung", "ware", "einkauf"] },
    {
        id: "bestellungen-neu",
        routePath: "bestellungen/neu",
        href: "/bestellungen/neu",
        titleDe: "Neue Bestellung",
        keywords: ["anlegen", "lieferant", "bestellung neu"],
    },
    { id: "bilanz", routePath: "bilanz", href: "/bilanz", titleDe: "Bilanz", keywords: ["buchhaltung"] },
    { id: "bilanz-neu", routePath: "bilanz/neu", href: "/bilanz/neu", titleDe: "Neuer Bilanz (Assistent)", keywords: ["wizard", "neu", "bilanz"] },
    { id: "verwaltung", routePath: "verwaltung", href: "/verwaltung", titleDe: "Verwaltung (Übersicht)", keywords: ["admin", "einstellungen praxis"] },
    { id: "verwaltung-arbeitstage", routePath: "verwaltung/arbeitstage", href: "/verwaltung/arbeitstage", titleDe: "Arbeitstage & Urlaub", keywords: ["kalender", "abwesenheit", "urlaub"] },
    { id: "verwaltung-praxisplanung", routePath: "verwaltung/praxisplanung", href: "/verwaltung/praxisplanung", titleDe: "Praxisplanung", keywords: ["feiertage", "arbeitszeit", "praeferenzen"] },
    { id: "verwaltung-arbeitszeiten", routePath: "verwaltung/arbeitszeiten", href: "/verwaltung/arbeitszeiten", titleDe: "Arbeitszeiten", keywords: ["sprechzeiten", "pause", "slotdauer"] },
    { id: "verwaltung-sonder-sperrzeiten", routePath: "verwaltung/sonder-sperrzeiten", href: "/verwaltung/sonder-sperrzeiten", titleDe: "Sonder-Sperrzeiten", keywords: ["schliessung", "halbtag", "notfall", "sperren"] },
    { id: "verwaltung-praeferenzen", routePath: "verwaltung/praxis-praeferenzen", href: "/verwaltung/praxis-praeferenzen", titleDe: "Praxis-Präferenzen", keywords: ["terminregeln", "reminder", "noshow"] },
    { id: "verwaltung-vorlagen", routePath: "verwaltung/vorlagen", href: "/verwaltung/vorlagen", titleDe: "Vorlagen Rezepte & Atteste", keywords: ["vorlage", "medikament", "attest"] },
    {
        id: "verwaltung-vorlagen-editor",
        routePath: "verwaltung/vorlagen/editor",
        href: "/verwaltung/vorlagen/editor",
        titleDe: "Vorlagen-Editor (Weiterleitung)",
        keywords: ["vorlage", "editor", "rezept", "attest", "bearbeiten"],
    },
    { id: "verwaltung-behandlungs-katalog", routePath: "verwaltung/behandlungs-katalog", href: "/verwaltung/behandlungs-katalog", titleDe: "Behandlungskatalog (Leistungen)", keywords: ["behandlung", "katalog", "leistung", "kategorie"] },
    {
        id: "verwaltung-bestellstamm",
        routePath: "verwaltung/bestellstamm",
        href: "/verwaltung/bestellstamm",
        titleDe: "Bestell-Stammdaten (Lieferant / Kontakt)",
        keywords: ["lieferant", "pharmaberater", "bestellung", "stamm"],
    },
    {
        id: "verwaltung-finanzen-berichte",
        routePath: "verwaltung/finanzen-berichte",
        href: "/verwaltung/finanzen-berichte",
        titleDe: "Finanzen & Berichte (Verwaltung)",
        keywords: ["bilanz", "rechnung", "tagesabschluss", "berichte"],
    },
    {
        id: "verwaltung-team",
        routePath: "verwaltung/team",
        href: "/verwaltung/team",
        titleDe: "Team (Verwaltung)",
        keywords: ["personal", "mitarbeiter", "arbeitsplan", "einsätze", "schicht", "plan"],
    },
    {
        id: "verwaltung-lager-bestellwesen",
        routePath: "verwaltung/lager-und-bestellwesen",
        href: "/verwaltung/lager-und-bestellwesen",
        titleDe: "Lager, Produkte & Bestellwesen (Verwaltung)",
        keywords: ["produkt", "lager", "lieferant", "bestellstamm", "material"],
    },
    {
        id: "verwaltung-vertraege",
        routePath: "verwaltung/vertraege",
        href: "/verwaltung/vertraege",
        titleDe: "Verträge (Kosten / Ausgaben)",
        keywords: ["miete", "versicherung", "vertrag", "dauerkosten", "labor"],
    },
    {
        id: "verwaltung-leistungen-kataloge-vorlagen",
        routePath: "verwaltung/leistungen-kataloge-vorlagen",
        href: "/verwaltung/leistungen-kataloge-vorlagen",
        titleDe: "Leistungen, Kataloge & Vorlagen (Verwaltung)",
        keywords: ["goz", "behandlungskatalog", "rezept", "attest", "vorlage", "leistung"],
    },
    {
        id: "verwaltung-tagesabschluss",
        routePath: "verwaltung/finanzen-berichte/tagesabschluss",
        href: "/verwaltung/finanzen-berichte/tagesabschluss",
        titleDe: "Tagesabschluss (Finanzen & Berichte)",
        keywords: ["kasse", "kassenabgleich", "tagesabschluss", "bar", "bargeld"],
    },
    {
        id: "verwaltung-finanz-werkzeuge",
        routePath: "verwaltung/finanzen-berichte/rechnung",
        href: "/verwaltung/finanzen-berichte/rechnung",
        titleDe: "Rechnung (PDF) (Finanzen & Berichte)",
        keywords: ["rechnung", "pdf", "invoice", "faktura"],
    },
    { id: "rezepte", routePath: "rezepte", href: "/rezepte", titleDe: "Rezepte", keywords: ["medikament"] },
    { id: "atteste", routePath: "atteste", href: "/atteste", titleDe: "Atteste", keywords: ["bescheinigung"] },
    { id: "leistungen", routePath: "leistungen", href: "/leistungen", titleDe: "Leistungen", keywords: ["goz", "honorar"] },
    { id: "leistungen-neu", routePath: "leistungen", href: "/leistungen?neu=1", titleDe: "Neue Leistung", keywords: ["anlegen"] },
    { id: "produkte", routePath: "produkte", href: "/produkte", titleDe: "Produkte & Lager", keywords: ["material", "lager"] },
    { id: "personal", routePath: "personal", href: "/personal", titleDe: "Personal (über Verwaltung)", keywords: ["team", "mitarbeiter", "personal"] },
    {
        id: "personal-arbeitsplan",
        routePath: "personal/arbeitsplan",
        href: "/personal/arbeitsplan",
        titleDe: "Arbeitsplan & Einsätze (Personal)",
        keywords: ["schicht", "einsatz", "dienst", "woche", "plan"],
    },
    { id: "personal-neu", routePath: "personal/neu", href: "/personal/neu", titleDe: "Neues Personal", keywords: ["anlegen"] },
    { id: "statistik", routePath: "statistik", href: "/statistik", titleDe: "Statistiken", keywords: ["kennzahlen", "report"] },
    { id: "audit", routePath: "audit", href: "/audit", titleDe: "Audit-Log", keywords: ["protokoll", "nachvollziehbarkeit"] },
    { id: "datenschutz", routePath: "datenschutz", href: "/datenschutz", titleDe: "Datenschutz & DSGVO", keywords: ["privacy", "dsgvo"] },
    { id: "einstellungen", routePath: "einstellungen", href: "/einstellungen", titleDe: "Einstellungen", keywords: ["konto", "profil"] },
    { id: "logs", routePath: "logs", href: "/logs", titleDe: "System-Logs", keywords: ["debug", "fehler"] },
    { id: "ops", routePath: "ops", href: "/ops", titleDe: "Betrieb & Backup", keywords: ["backup", "migration"] },
    { id: "compliance", routePath: "compliance", href: "/compliance", titleDe: "Compliance", keywords: ["richtlinien"] },
    { id: "hilfe", routePath: "einstellungen", href: "/einstellungen?tab=hilfe", titleDe: "Hilfe & Kurzbefehle", keywords: ["bedienung", "shortcuts", "tastatur"] },
    { id: "feedback", routePath: "feedback", href: "/feedback", titleDe: "Feedback & Vigilanz", keywords: ["meldung", "hinweis", "sicherheit"] },
    { id: "migration", routePath: "migration", href: "/migration", titleDe: "Datenmigration (Assistent)", keywords: ["import", "umzug", "wizard"] },
];

export function filterCommandsForRole(rolle: string | undefined): PaletteCommand[] {
    return PALETTE_COMMANDS.filter((c) => routeChildPathAllowed(c.routePath, rolle));
}
