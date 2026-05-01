import type { InvoiceInput } from "@/controllers/invoice.controller";

const LS_KEY = "medoc-invoice-history-v1";
/** Öffentlich: max. Anzahl in UI-Hinweis (Rechnung PDF). */
export const INVOICE_HISTORY_MAX = 200;
const MAX_ENTRIES = INVOICE_HISTORY_MAX;

export type SavedInvoice = {
    id: string;
    createdAt: string;
    patientId: string;
    invoice: InvoiceInput;
};

function parse(raw: string | null): SavedInvoice[] {
    if (!raw) return [];
    try {
        const j = JSON.parse(raw) as unknown;
        if (!Array.isArray(j)) return [];
        return j.filter(
            (x): x is SavedInvoice =>
                x != null
                && typeof (x as SavedInvoice).id === "string"
                && typeof (x as SavedInvoice).createdAt === "string"
                && typeof (x as SavedInvoice).patientId === "string"
                && (x as SavedInvoice).invoice != null
                && typeof (x as SavedInvoice).invoice === "object",
        );
    } catch {
        return [];
    }
}

export function loadInvoiceHistory(): SavedInvoice[] {
    if (globalThis.localStorage == null) return [];
    return parse(localStorage.getItem(LS_KEY)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveInvoiceHistory(entries: SavedInvoice[]): void {
    if (globalThis.localStorage == null) return;
    const trimmed = entries.slice(0, MAX_ENTRIES);
    localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
}

export function appendInvoiceHistory(entry: SavedInvoice): void {
    const rest = loadInvoiceHistory().filter((x) => x.id !== entry.id);
    saveInvoiceHistory([entry, ...rest]);
}

/** Drop cached PDF payloads for one patient (local-only history). */
export function removeInvoiceHistoryForPatient(patientId: string): void {
    if (!patientId || globalThis.localStorage == null) return;
    const rest = loadInvoiceHistory().filter((x) => x.patientId !== patientId);
    saveInvoiceHistory(rest);
}

export function sumInvoiceEur(inv: InvoiceInput): number {
    const cents = inv.lines.reduce((s, l) => s + l.amount_cents, 0);
    return Math.round(cents) / 100;
}
