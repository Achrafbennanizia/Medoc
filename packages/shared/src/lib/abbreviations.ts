export type LabelPair = { full: string; short: string; aria: string };

/**
 * Curated short forms for cramped UI (toolbars, table headers). Never use raw ellipsis truncation
 * for these concepts — use `pickLabel` + {@link ResponsiveLabel}.
 *
 * English source strings; wire DE/AR/FR via i18n when consumers pass a locale (PROPOSED).
 */
export const LABELS = {
    bestellnummer: { full: "Order number", short: "Ord. no.", aria: "Order number" },
    behandlungsnummer: { full: "Treatment number", short: "T-no.", aria: "Treatment number" },
    untersuchungsnummer: { full: "Examination number", short: "E-no.", aria: "Examination number" },
    sitzungsnummer: { full: "Session number", short: "Sess.", aria: "Session number" },
    zahlungsart_ueberweisung: { full: "Bank transfer", short: "Xfer", aria: "Bank transfer" },
    zahlungsart_rechnung: { full: "Invoice", short: "Inv.", aria: "Invoice" },
    zahlungsart_bar: { full: "Cash", short: "Cash", aria: "Cash payment" },
    zahlungsart_karte: { full: "Card", short: "Card", aria: "Card payment" },
    leistung: { full: "Service", short: "Svc.", aria: "Service" },
    patientenakte: { full: "Patient record", short: "Record", aria: "Patient record" },
    geburtsdatum: { full: "Date of birth", short: "DOB", aria: "Date of birth" },
    kontakt: { full: "Contact", short: "Cont.", aria: "Contact" },
    verfuegbarkeit: { full: "Availability", short: "Avail.", aria: "Availability" },
    steuernummer: { full: "Tax number", short: "Tax no.", aria: "Tax number" },
    kv_nummer: { full: "KV number", short: "KV no.", aria: "Statutory health insurance connection number" },
} as const satisfies Record<string, LabelPair>;

export type LabelKey = keyof typeof LABELS;

export function pickLabel(key: LabelKey, mode: "full" | "short"): string {
    const row = LABELS[key];
    return mode === "short" ? row.short : row.full;
}

export function ariaForLabel(key: LabelKey): string {
    return LABELS[key].aria;
}
