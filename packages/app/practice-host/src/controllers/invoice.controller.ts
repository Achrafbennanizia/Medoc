import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import {
    nextReportNumber,
    nextInvoiceNumber,
    type InvoiceNumberOpts,
} from "@/lib/invoice-service-item";

export interface InvoiceLineInput {
    description: string;
    amount_cents: number;
    goz_nr?: string | null;
    factor?: number | null;
    unit_price_cents?: number | null;
    quantity?: number | null;
    tooth_nr?: string | null;
    treatment_date?: string | null;
    vat_percent?: number | null;
    material?: string | null;
    diagnosis_reason?: string | null;
}

export interface InvoiceInput {
    number: string;
    date: string;
    recipient_name: string;
    recipient_address: string[];
    practice_name: string;
    practice_address: string[];
    lines: InvoiceLineInput[];
    note?: string | null;
    clinician_name?: string | null;
    clinician_zanr?: string | null;
    practice_bsnr?: string | null;
    bank_details?: string[] | null;
    payment_terms_text?: string | null;
    vat_notice?: string | null;
}

export type InvoiceDocKind = "RE" | "BR" | "QU";

/** Leftover German IPC keys from stored invoice history (dual-read). */
type LeftoverInvoiceLine = InvoiceLineInput & {
    faktor?: number | null;
    einzelpreis_cents?: number | null;
    zahn_nr?: string | null;
    behandlungsdatum?: string | null;
    ust_prozent?: number | null;
};

type LeftoverInvoice = InvoiceInput & {
    bankverbindung?: string[] | null;
    ust_hinweis?: string | null;
    lines: LeftoverInvoiceLine[];
};

function normalizeInvoiceInput(invoice: LeftoverInvoice): InvoiceInput {
    return {
        ...invoice,
        bank_details: invoice.bank_details ?? invoice.bankverbindung ?? null,
        vat_notice: invoice.vat_notice ?? invoice.ust_hinweis ?? null,
        lines: invoice.lines.map((l) => ({
            ...l,
            factor: l.factor ?? l.faktor ?? null,
            unit_price_cents: l.unit_price_cents ?? l.einzelpreis_cents ?? null,
            tooth_nr: l.tooth_nr ?? l.zahn_nr ?? null,
            treatment_date: l.treatment_date ?? l.behandlungsdatum ?? null,
            vat_percent: l.vat_percent ?? l.ust_prozent ?? null,
        })),
    };
}

export async function allocateReceiptNumber(ymd: string): Promise<string> {
    return allocateInvoiceDocumentNumber("QU", ymd);
}

/** Sequential number from SQLite (`BEGIN IMMEDIATE`); offline/error → client-side fallback. */
export async function allocateInvoiceDocumentNumber(kind: InvoiceDocKind, ymd: string): Promise<string> {
    return practiceSystem.invoke<string>("allocate_invoice_document_number", { kind, ymd });
}

export async function allocateInvoiceNumber(
    ymd: string,
    fallback?: InvoiceNumberOpts,
): Promise<string> {
    try {
        return await allocateInvoiceDocumentNumber("RE", ymd);
    } catch {
        return nextInvoiceNumber(ymd, fallback);
    }
}

export async function allocateReportNumber(
    ymd: string,
    fallback?: InvoiceNumberOpts,
): Promise<string> {
    try {
        return await allocateInvoiceDocumentNumber("BR", ymd);
    } catch {
        return nextReportNumber(ymd, fallback);
    }
}

/** FA-FIN-INVOICE: PDF bytes from the Rust print engine. */
export async function renderInvoicePdf(invoice: InvoiceInput): Promise<Uint8Array> {
    const raw = await practiceSystem.invoke<number[]>("render_invoice_pdf", {
        invoice: normalizeInvoiceInput(invoice),
    });
    return new Uint8Array(raw);
}
