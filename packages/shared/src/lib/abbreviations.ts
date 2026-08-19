export type LabelPair = { full: string; short: string; aria: string };

/**
 * Curated short forms for cramped UI (toolbars, table headers). Never use raw ellipsis truncation
 * for these concepts — use `pickLabel` + {@link ResponsiveLabel}.
 *
 * English source strings; wire DE/AR/FR via i18n when consumers pass a locale (PROPOSED).
 */
export const LABELS = {
    order_number: { full: "Order number", short: "Ord. no.", aria: "Order number" },
    treatment_number: { full: "Treatment number", short: "T-no.", aria: "Treatment number" },
    examination_number: { full: "Examination number", short: "E-no.", aria: "Examination number" },
    sitzungsnummer: { full: "Session number", short: "Sess.", aria: "Session number" },
    payment_method_bank_transfer: { full: "Bank transfer", short: "Xfer", aria: "Bank transfer" },
    payment_method_invoice: { full: "Invoice", short: "Inv.", aria: "Invoice" },
    payment_method_bar: { full: "Cash", short: "Cash", aria: "Cash payment" },
    payment_method_card: { full: "Card", short: "Card", aria: "Card payment" },
    service_item: { full: "Service", short: "Svc.", aria: "Service" },
    patient_chart: { full: "Patient record", short: "Record", aria: "Patient record" },
    date_of_birth: { full: "Date of birth", short: "DOB", aria: "Date of birth" },
    contact: { full: "Contact", short: "Cont.", aria: "Contact" },
    verfuegbarkeit: { full: "Availability", short: "Avail.", aria: "Availability" },
    tax_number: { full: "Tax number", short: "Tax no.", aria: "Tax number" },
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
