import { routeChildPathAllowed } from "./rbac";

/**
 * Static routes wired to {@link ROUTE_VISIBILITY} keys (must match `App.tsx`).
 */
export type PaletteCommand = {
    id: string;
    routePath: string;
    href: string;
    /** i18n key under palette.cmd.* */
    titleKey: string;
    keywords: string[];
};

function cmd(id: string, routePath: string, href: string, keywords: string[]): PaletteCommand {
    return { id, routePath, href, titleKey: `palette.cmd.${id}`, keywords };
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
    cmd("dash", "", "/", ["home", "start"]),
    cmd("termine", "termine", "/termine", ["kalender", "termin", "appointment", "patientenakte", "übersicht"]),
    cmd("termine-neu", "termine/neu", "/termine/neu", ["anlegen", "termin neu", "buchung"]),
    cmd("patienten", "patienten", "/patienten", ["akte", "patient", "patientenakte", "stammdaten"]),
    cmd("patienten-neu", "patienten/neu", "/patienten/neu", ["anlegen", "neu"]),
    cmd("akten-zu-validieren", "akten/zu-validieren", "/akten/zu-validieren", ["validierung", "akte", "arzt", "entwurf", "fa-akte-15"]),
    cmd("praxis-tickets", "tickets", "/tickets", ["ticket", "rezeption", "arzt", "nachricht", "fa-pers-08"]),
    cmd("finanzen", "finanzen", "/finanzen", ["geld", "kasse"]),
    cmd("finanzen-kasse", "finanzen/kasse", "/finanzen/kasse", ["kasse", "rezeption", "zahlung", "bar", "eingang", "tagesabschluss"]),
    cmd("finanzen-neu", "finanzen/neu", "/finanzen/neu", ["anlegen", "einnahme", "buchung", "kasse", "zahlung"]),
    cmd("finanzen-kasse-neu", "finanzen/kasse/neu", "/finanzen/kasse/neu", ["anlegen", "einnahme", "kasse", "zahlung", "rezeption"]),
    cmd("bestellungen", "bestellungen", "/bestellungen", ["lieferung", "ware", "einkauf"]),
    cmd("bestellungen-neu", "bestellungen/neu", "/bestellungen/neu", ["anlegen", "lieferant", "bestellung neu"]),
    cmd("bilanz", "bilanz", "/bilanz", ["buchhaltung"]),
    cmd("bilanz-neu", "bilanz/neu", "/bilanz/neu", ["wizard", "neu", "bilanz"]),
    cmd("verwaltung", "verwaltung", "/verwaltung", ["admin", "einstellungen praxis"]),
    cmd("verwaltung-arbeitstage", "verwaltung/arbeitstage", "/verwaltung/arbeitstage", ["kalender", "abwesenheit", "urlaub"]),
    cmd("verwaltung-praxisplanung", "verwaltung/praxisplanung", "/verwaltung/praxisplanung", ["feiertage", "arbeitszeit", "praeferenzen"]),
    cmd("verwaltung-arbeitszeiten", "verwaltung/arbeitszeiten", "/verwaltung/arbeitszeiten", ["sprechzeiten", "pause", "slotdauer"]),
    cmd("verwaltung-sonder-sperrzeiten", "verwaltung/sonder-sperrzeiten", "/verwaltung/sonder-sperrzeiten", ["schliessung", "halbtag", "notfall", "sperren"]),
    cmd("verwaltung-praeferenzen", "verwaltung/praxis-praeferenzen", "/verwaltung/praxis-praeferenzen", ["terminregeln", "reminder", "noshow"]),
    cmd("verwaltung-vorlagen", "verwaltung/vorlagen", "/verwaltung/vorlagen", ["vorlage", "medikament", "attest"]),
    cmd("verwaltung-vorlagen-editor", "verwaltung/vorlagen/editor", "/verwaltung/vorlagen/editor", ["vorlage", "editor", "rezept", "attest", "bearbeiten"]),
    cmd("verwaltung-behandlungs-katalog", "verwaltung/behandlungs-katalog", "/verwaltung/behandlungs-katalog", ["behandlung", "katalog", "leistung", "kategorie"]),
    cmd("verwaltung-bestellstamm", "verwaltung/bestellstamm", "/verwaltung/bestellstamm", ["lieferant", "pharmaberater", "bestellung", "stamm"]),
    cmd("verwaltung-finanzen-berichte", "verwaltung/finanzen-berichte", "/verwaltung/finanzen-berichte", ["bilanz", "rechnung", "tagesabschluss", "berichte"]),
    cmd("verwaltung-team", "verwaltung/team", "/verwaltung/team", ["personal", "mitarbeiter", "arbeitsplan", "einsätze", "schicht", "plan"]),
    cmd("verwaltung-lager-bestellwesen", "verwaltung/lager-und-bestellwesen", "/verwaltung/lager-und-bestellwesen", ["produkt", "lager", "lieferant", "bestellstamm", "material"]),
    cmd("verwaltung-vertraege", "verwaltung/vertraege", "/verwaltung/vertraege", ["miete", "versicherung", "vertrag", "dauerkosten", "labor"]),
    cmd("verwaltung-leistungen-kataloge-vorlagen", "verwaltung/leistungen-kataloge-vorlagen", "/verwaltung/leistungen-kataloge-vorlagen", ["goz", "behandlungskatalog", "rezept", "attest", "vorlage", "leistung"]),
    cmd("verwaltung-tagesabschluss", "verwaltung/finanzen-berichte/tagesabschluss", "/verwaltung/finanzen-berichte/tagesabschluss", ["kasse", "kassenabgleich", "tagesabschluss", "bar", "bargeld"]),
    cmd("verwaltung-finanz-werkzeuge", "verwaltung/finanzen-berichte/rechnung", "/verwaltung/finanzen-berichte/rechnung", ["rechnung", "pdf", "invoice", "faktura"]),
    cmd("rezepte", "rezepte", "/rezepte", ["medikament"]),
    cmd("atteste", "atteste", "/atteste", ["bescheinigung"]),
    cmd("leistungen", "leistungen", "/leistungen", ["goz", "honorar"]),
    cmd("leistungen-neu", "leistungen", "/leistungen?neu=1", ["anlegen"]),
    cmd("produkte", "produkte", "/produkte", ["material", "lager"]),
    cmd("personal", "personal", "/personal", ["team", "mitarbeiter", "personal"]),
    cmd("personal-arbeitsplan", "personal/arbeitsplan", "/personal/arbeitsplan", ["schicht", "einsatz", "dienst", "woche", "plan"]),
    cmd("personal-arbeitszeit", "personal/arbeitszeit", "/personal/arbeitszeit", ["zeit", "stempeln", "pause", "schicht"]),
    cmd("verwaltung-team-arbeitszeit", "verwaltung/team/arbeitszeit", "/verwaltung/team/arbeitszeit", ["mitarbeiter", "übersicht", "stunden", "team"]),
    cmd("personal-neu", "personal/neu", "/personal/neu", ["anlegen"]),
    cmd("statistik", "statistik", "/statistik", ["kennzahlen", "report"]),
    cmd("audit", "audit", "/audit", ["protokoll", "nachvollziehbarkeit"]),
    cmd("datenschutz", "datenschutz", "/datenschutz", ["privacy", "dsgvo"]),
    cmd("einstellungen", "einstellungen", "/einstellungen", ["konto", "profil"]),
    cmd("logs", "logs", "/logs", ["debug", "fehler"]),
    cmd("ops", "ops", "/ops", ["backup", "migration"]),
    cmd("compliance", "compliance", "/compliance", ["richtlinien"]),
    cmd("hilfe", "hilfe", "/hilfe", ["bedienung", "shortcuts", "tastatur"]),
    cmd("feedback", "feedback", "/feedback", ["meldung", "hinweis", "sicherheit"]),
    cmd("migration", "migration", "/migration", ["import", "umzug", "wizard"]),
];

export function filterCommandsForRole(
    rolle: string | undefined,
    overrides?: import("@/models/types").PermissionOverride[] | null,
): PaletteCommand[] {
    return PALETTE_COMMANDS.filter((c) => routeChildPathAllowed(c.routePath, rolle, overrides));
}

export function filterCommandsForFocusMode(commands: PaletteCommand[]): PaletteCommand[] {
    const allowed = new Set(["", "personal/arbeitszeit", "einstellungen"]);
    return commands.filter((c) => allowed.has(c.routePath));
}
