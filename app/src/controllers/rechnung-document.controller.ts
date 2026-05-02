import { tauriInvoke } from "@/services/tauri.service";
import type { InvoiceInput } from "@/controllers/invoice.controller";

export const INVOICE_HISTORY_MAX = 200;

export type SavedInvoice = {
    id: string;
    createdAt: string;
    patientId: string;
    invoice: InvoiceInput;
};

export type RechnungDocumentListRow = {
    id: string;
    patient_id: string;
    document_number: string;
    payload_json: string;
    total_cents: number;
    created_at: string;
    created_by: string;
};

const LEGACY_LS_KEY = "medoc-invoice-history-v1";

function parseLegacy(raw: string | null): SavedInvoice[] {
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

export function sumInvoiceEur(inv: InvoiceInput): number {
    const cents = inv.lines.reduce((s, l) => s + l.amount_cents, 0);
    return Math.round(cents) / 100;
}

export async function listRechnungDocuments(limit?: number): Promise<SavedInvoice[]> {
    const lim = Math.min(limit ?? INVOICE_HISTORY_MAX, INVOICE_HISTORY_MAX);
    const rows = await tauriInvoke<RechnungDocumentListRow[]>("list_rechnung_documents", {
        limit: lim,
    });
    return rows.map((r) => {
        let invoice: InvoiceInput;
        try {
            invoice = JSON.parse(r.payload_json) as InvoiceInput;
        } catch {
            invoice = {
                number: r.document_number,
                date: r.created_at.slice(0, 10),
                recipient_name: "",
                recipient_address: [],
                practice_name: "",
                practice_address: [],
                lines: [],
                note: null,
            };
        }
        return {
            id: r.id,
            createdAt: r.created_at,
            patientId: r.patient_id,
            invoice,
        };
    });
}

export async function appendRechnungDocument(entry: SavedInvoice): Promise<void> {
    const totalCents = Math.round(sumInvoiceEur(entry.invoice) * 100);
    await tauriInvoke<void>("append_rechnung_document", {
        input: {
            id: entry.id,
            patient_id: entry.patientId,
            document_number: entry.invoice.number,
            payload_json: JSON.stringify(entry.invoice),
            total_cents: totalCents,
        },
    });
}

/** Import at most one batch from legacy localStorage (call from finanzen page on mount). */
export async function migrateLegacyInvoiceHistoryFromLocalStorageOnce(): Promise<void> {
    if (typeof window === "undefined" || globalThis.localStorage == null) return;
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(LEGACY_LS_KEY);
    } catch {
        return;
    }
    const entries = parseLegacy(raw);
    if (entries.length === 0) {
        try {
            localStorage.removeItem(LEGACY_LS_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    const existing = await listRechnungDocuments(INVOICE_HISTORY_MAX);
    const existingIds = new Set(existing.map((e) => e.id));
    for (const e of entries) {
        if (!existingIds.has(e.id)) {
            try {
                await appendRechnungDocument(e);
            } catch {
                /* if offline, keep LS */
                return;
            }
        }
    }
    try {
        localStorage.removeItem(LEGACY_LS_KEY);
    } catch {
        /* ignore */
    }
}

export function stripLegacyInvoiceHistoryLocalStorage(): void {
    if (globalThis.localStorage == null) return;
    try {
        localStorage.removeItem(LEGACY_LS_KEY);
    } catch {
        /* ignore */
    }
}
