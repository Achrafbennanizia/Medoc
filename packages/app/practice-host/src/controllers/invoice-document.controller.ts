import { moneyToInvoiceCents } from "@/lib/invoice-service-item";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { InvoiceInput, InvoiceLineInput } from "@/systems/practice-host/controllers/invoice.controller";
import type { IssuedPdf } from "@/systems/practice-host/controllers/document.controller";

export const INVOICE_HISTORY_MAX = 200;

/** Derived on the server from linked payments (`source_ref`). */
export type InvoicePaymentState =
    | "OPEN"
    | "PARTIAL"
    | "PAID"
    | "OVERDUE"
    | "CANCELLED"
    | "CANCELLATION"
    | "UNLINKED"
    | "LEGACY";

export type SavedInvoice = {
    id: string;
    createdAt: string;
    patientId: string;
    invoice: InvoiceInput;
    /** INVOICE | CANCELLATION (registry); missing for legacy imports. */
    kind?: "INVOICE" | "CANCELLATION";
    /** Registry status: ISSUED | CANCELLED. */
    status?: "ISSUED" | "CANCELLED";
    paymentState?: InvoicePaymentState;
    totalCents?: number;
    paidCents?: number;
    openCents?: number;
    dueDate?: string | null;
    cancelsNumber?: string | null;
    cancelledByNumber?: string | null;
    reminderLevel?: number;
    nextReminderLevel?: number | null;
    lastReminderNumber?: string | null;
    lastReminderPayBy?: string | null;
};

/** Row of `list_invoice_status` (camelCase from the server). */
export type InvoiceStatusRow = {
    documentId: string;
    documentNumber: string;
    kind: "INVOICE" | "CANCELLATION";
    status: "ISSUED" | "CANCELLED";
    patientId: string | null;
    patientName: string;
    recipientName: string;
    date: string;
    dueDate: string | null;
    totalCents: number;
    paidCents: number;
    openCents: number;
    paymentState: InvoicePaymentState;
    cancelsNumber: string | null;
    cancelledByNumber: string | null;
    reminderLevel: number;
    lastReminderNumber: string | null;
    lastReminderPayBy: string | null;
    nextReminderLevel: number | null;
    issuedAt: string;
    invoice: unknown;
};

export type PaymentReminderRow = {
    id: string;
    invoiceDocumentId: string;
    invoiceNumber: string;
    level: 1 | 2 | 3;
    documentNumber: string;
    openCents: number;
    feeCents: number;
    payBy: string;
    issuedBy: string;
    issuedAt: string;
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

function firstString(row: Record<string, unknown>, ...keys: string[]): string {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === "string") return value;
    }
    return "";
}

function firstNumber(row: Record<string, unknown>, ...keys: string[]): number {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return 0;
}

function firstOptionalNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
    for (const key of keys) {
        const value = row[key];
        if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return null;
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
              // Keep every stored field (GOZ number, factor, tooth, source_ref …);
              // dropping them made the read view and reprints incomplete.
              .map((line) => {
                  const description = firstString(
                      line,
                      "description",
                      "label",
                      "text",
                      "service",
                      "service_name",
                      "serviceName",
                  );
                  const cents = firstNumber(line, "amount_cents", "amountCents");
                  const euros = firstNumber(line, "total_cost", "totalCost", "amount", "price");
                  const amount_cents = cents > 0 ? Math.round(cents) : euros > 0 ? moneyToInvoiceCents(euros) : 0;
                  const goz = firstString(line, "goz_nr", "gozNr");
                  const schedule = firstString(line, "fee_schedule", "feeSchedule");
                  const fee_schedule = schedule || (goz ? "goz" : "other");
                  const treatment = firstString(
                      line,
                      "treatment_date",
                      "treatmentDate",
                      "date",
                      "service_date",
                      "serviceDate",
                      "created_at",
                      "createdAt",
                  ).slice(0, 10);
                  const source = firstString(line, "source_ref", "sourceRef");
                  return {
                      ...(line as Partial<InvoiceLineInput>),
                      description,
                      amount_cents,
                      fee_schedule,
                      goz_nr: goz || null,
                      treatment_date: treatment || null,
                      source_ref: source || null,
                      factor: firstOptionalNumber(line, "factor"),
                      points: firstOptionalNumber(line, "points"),
                  } as InvoiceLineInput;
              })
        : [];
    return {
        number: typeof o.number === "string" && o.number.trim() ? o.number : (fallback.number ?? ""),
        date: typeof o.date === "string" && o.date.trim() ? o.date : (fallback.date ?? ""),
        recipient_name: firstString(o, "recipient_name", "recipientName"),
        recipient_address: asStringArray(o.recipient_address ?? o.recipientAddress),
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

/** Line sum (net). Prefer `SavedInvoice.totalCents` (gross, from the server). */
export function sumInvoiceEur(inv: InvoiceInput): number {
    const cents = (inv.lines ?? []).reduce((s, l) => s + (l.amount_cents ?? 0), 0);
    return Math.round(cents) / 100;
}

function fromStatusRow(r: InvoiceStatusRow): SavedInvoice {
    return {
        id: r.documentId,
        createdAt: r.issuedAt,
        patientId: r.patientId ?? "",
        invoice: normalizeInvoiceInput(r.invoice, { number: r.documentNumber, date: r.date }),
        kind: r.kind,
        status: r.status,
        paymentState: r.paymentState,
        totalCents: r.totalCents,
        paidCents: r.paidCents,
        openCents: r.openCents,
        dueDate: r.dueDate,
        cancelsNumber: r.cancelsNumber,
        cancelledByNumber: r.cancelledByNumber,
        reminderLevel: r.reminderLevel,
        nextReminderLevel: r.nextReminderLevel,
        lastReminderNumber: r.lastReminderNumber,
        lastReminderPayBy: r.lastReminderPayBy,
    };
}

export async function listInvoiceStatus(filter?: {
    patientId?: string;
    openOnly?: boolean;
    limit?: number;
}): Promise<SavedInvoice[]> {
    const rows = await practiceSystem.invoke<InvoiceStatusRow[]>("list_invoice_status", { filter: filter ?? {} });
    return rows.map(fromStatusRow);
}

export async function getInvoiceStatus(documentId: string): Promise<SavedInvoice> {
    return fromStatusRow(await practiceSystem.invoke<InvoiceStatusRow>("get_invoice_status", { documentId }));
}

/** Zahlungserinnerung (level 1), 1. Mahnung (2), 2. Mahnung (3). `preview` = draft. */
export async function issuePaymentReminder(args: {
    invoiceDocumentId: string;
    preview?: boolean;
    feeCents?: number;
    days?: number;
}): Promise<IssuedPdf> {
    return practiceSystem.invoke<IssuedPdf>("issue_payment_reminder", {
        args: { preview: false, feeCents: 0, ...args },
    });
}

export async function listPaymentReminders(invoiceDocumentId: string): Promise<PaymentReminderRow[]> {
    return practiceSystem.invoke<PaymentReminderRow[]>("list_payment_reminders", { invoiceDocumentId });
}

export async function paymentReminderCopy(reminderId: string): Promise<IssuedPdf> {
    return practiceSystem.invoke<IssuedPdf>("payment_reminder_copy", { reminderId });
}

/**
 * Invoice history: registry invoices with payment state, plus rows imported
 * from the old browser history (marked `LEGACY`, not official documents).
 */
export async function listInvoiceDocuments(limit?: number): Promise<SavedInvoice[]> {
    const lim = Math.min(limit ?? INVOICE_HISTORY_MAX, INVOICE_HISTORY_MAX);
    let registry: SavedInvoice[] = [];
    try {
        registry = await listInvoiceStatus({ limit: lim });
    } catch {
        registry = [];
    }
    const known = new Set(registry.map((r) => r.id));
    const legacy = (await listLegacyInvoiceDocuments(lim)).filter((r) => !known.has(r.id));
    return [...registry, ...legacy.map((r) => ({ ...r, paymentState: "LEGACY" as const }))]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, lim);
}

async function listLegacyInvoiceDocuments(limit?: number): Promise<SavedInvoice[]> {
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

/** Legacy import only (browser history before the registry). The server refuses registry numbers. */
export async function appendInvoiceDocument(entry: SavedInvoice): Promise<void> {
    const totalCents = moneyToInvoiceCents(sumInvoiceEur(entry.invoice));
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
    const existing = await listLegacyInvoiceDocuments(INVOICE_HISTORY_MAX);
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
