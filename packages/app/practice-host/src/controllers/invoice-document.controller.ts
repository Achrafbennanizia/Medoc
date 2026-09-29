import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { InvoiceInput } from "@/systems/practice-host/controllers/invoice.controller";

export const INVOICE_HISTORY_MAX = 200;

export type SavedInvoice = {
    id: string;
    createdAt: string;
    patientId: string;
    invoice: InvoiceInput;
};

export type InvoiceDocumentListRow = {
    id: string;
    patient_id: string;
    document_number: string;
    payload_json: string;
    total_cents: number;
    created_at: string;
    created_by: string;
};

const LEGACY_LS_KEY = "medoc-invoice-history-v1";

function asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((x) => (typeof x === "string" ? x : String(x ?? ""))).map((s) => s.trim()).filter(Boolean);
    }
    if (typeof value === "string") {
        return value.split("\n").map((s) => s.trim()).filter(Boolean);
    }
    return [];
}

function asOptionalString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

/** Fill missing fields from older SQLite / localStorage invoice payloads. */
export function normalizeInvoiceInput(
    raw: unknown,
    fallback: { number?: string; date?: string } = {},
): InvoiceInput {
    const o = raw != null && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const linesRaw = o.lines;
    const lines = Array.isArray(linesRaw)
        ? linesRaw
              .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
              .map((line) => ({
                  description: typeof line.description === "string" ? line.description : "",
                  amount_cents: typeof line.amount_cents === "number" && Number.isFinite(line.amount_cents) ? line.amount_cents : 0,
              }))
        : [];
    return {
        number: typeof o.number === "string" && o.number.trim() ? o.number : (fallback.number ?? ""),
        date: typeof o.date === "string" && o.date.trim() ? o.date : (fallback.date ?? ""),
        recipient_name: typeof o.recipient_name === "string" ? o.recipient_name : "",
        recipient_address: asStringArray(o.recipient_address),
        practice_name: typeof o.practice_name === "string" ? o.practice_name : "",
        practice_address: asStringArray(o.practice_address),
        lines,
        note: asOptionalString(o.note),
        clinician_name: asOptionalString(o.clinician_name),
        clinician_zanr: asOptionalString(o.clinician_zanr),
        practice_bsnr: asOptionalString(o.practice_bsnr),
        bank_details: Array.isArray(o.bank_details) ? asStringArray(o.bank_details) : o.bank_details == null ? null : asStringArray(o.bank_details),
        payment_terms_text: asOptionalString(o.payment_terms_text),
        vat_notice: asOptionalString(o.vat_notice),
        locale: asOptionalString(o.locale),
        rtl: typeof o.rtl === "boolean" ? o.rtl : null,
    };
}

function parseLegacy(raw: string | null): SavedInvoice[] {
    if (!raw) return [];
    try {
        const j = JSON.parse(raw) as unknown;
        if (!Array.isArray(j)) return [];
        const out: SavedInvoice[] = [];
        for (const x of j) {
            if (x == null || typeof x !== "object") continue;
            const row = x as Partial<SavedInvoice>;
            if (typeof row.id !== "string" || typeof row.createdAt !== "string" || typeof row.patientId !== "string") {
                continue;
            }
            out.push({
                id: row.id,
                createdAt: row.createdAt,
                patientId: row.patientId,
                invoice: normalizeInvoiceInput(row.invoice),
            });
        }
        return out;
    } catch {
        return [];
    }
}

export function sumInvoiceEur(inv: InvoiceInput): number {
    const cents = (inv.lines ?? []).reduce((s, l) => s + (l.amount_cents ?? 0), 0);
    return Math.round(cents) / 100;
}

export async function listInvoiceDocuments(limit?: number): Promise<SavedInvoice[]> {
    const lim = Math.min(limit ?? INVOICE_HISTORY_MAX, INVOICE_HISTORY_MAX);
    const rows = await practiceSystem.invoke<InvoiceDocumentListRow[]>("list_invoice_documents", {
        limit: lim,
    });
    return rows.map((r) => {
        let parsed: unknown = null;
        try {
            parsed = JSON.parse(r.payload_json) as unknown;
        } catch {
            parsed = null;
        }
        return {
            id: r.id,
            createdAt: r.created_at,
            patientId: r.patient_id,
            invoice: normalizeInvoiceInput(parsed, {
                number: r.document_number,
                date: r.created_at.slice(0, 10),
            }),
        };
    });
}

export async function appendInvoiceDocument(entry: SavedInvoice): Promise<void> {
    const totalCents = Math.round(sumInvoiceEur(entry.invoice) * 100);
    await practiceSystem.invoke<void>("append_invoice_document", {
        input: {
            id: entry.id,
            patient_id: entry.patientId,
            document_number: entry.invoice.number,
            payload_json: JSON.stringify(entry.invoice),
            total_cents: totalCents,
        },
    });
}

/** Import at most one batch from legacy localStorage (call from finance page on mount). */
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
    const existing = await listInvoiceDocuments(INVOICE_HISTORY_MAX);
    const existingIds = new Set(existing.map((e) => e.id));
    for (const e of entries) {
        if (!existingIds.has(e.id)) {
            try {
                await appendInvoiceDocument(e);
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
