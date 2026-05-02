export type LabelPair = { full: string; short: string; aria: string };

/**
 * Curated short forms for cramped UI (toolbars, table headers). Never use raw ellipsis truncation
 * for these concepts — use `pickLabel` + {@link ResponsiveLabel}.
 */
export const LABELS = {
    bestellnummer: { full: "Bestellnummer", short: "Best.-Nr.", aria: "Bestellnummer" },
    behandlungsnummer: { full: "Behandlungsnummer", short: "B-Nr.", aria: "Behandlungsnummer" },
    untersuchungsnummer: { full: "Untersuchungsnummer", short: "U-Nr.", aria: "Untersuchungsnummer" },
    sitzungsnummer: { full: "Sitzungsnummer", short: "Sitz.", aria: "Sitzungsnummer" },
    zahlungsart_ueberweisung: { full: "Überweisung", short: "Überw.", aria: "Überweisung" },
    zahlungsart_rechnung: { full: "Rechnung", short: "Rechn.", aria: "Rechnung" },
    zahlungsart_bar: { full: "Barzahlung", short: "Bar", aria: "Barzahlung" },
    zahlungsart_karte: { full: "Karte", short: "Karte", aria: "Kartenzahlung" },
    leistung: { full: "Leistung", short: "Leist.", aria: "Leistung" },
    patientenakte: { full: "Patientenakte", short: "Akte", aria: "Patientenakte" },
    geburtsdatum: { full: "Geburtsdatum", short: "Geb.-Dat.", aria: "Geburtsdatum" },
    kontakt: { full: "Kontakt", short: "Kont.", aria: "Kontakt" },
    verfuegbarkeit: { full: "Verfügbarkeit", short: "Verf.", aria: "Verfügbarkeit" },
    steuernummer: { full: "Steuernummer", short: "St.-Nr.", aria: "Steuernummer" },
    kv_nummer: { full: "KV-Nummer", short: "KV-Nr.", aria: "Kassenärztliche Verbindungsnummer" },
} as const satisfies Record<string, LabelPair>;

export type LabelKey = keyof typeof LABELS;

export function pickLabel(key: LabelKey, mode: "full" | "short"): string {
    const row = LABELS[key];
    return mode === "short" ? row.short : row.full;
}

export function ariaForLabel(key: LabelKey): string {
    return LABELS[key].aria;
}
