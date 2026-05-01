import { tauriInvoke } from "@/services/tauri.service";
import {
    nextBerichtNummer,
    nextRechnungsnummer,
    type InvoiceNumberOpts,
} from "@/lib/invoice-leistung";

export interface InvoiceLineInput {
    description: string;
    amount_cents: number;
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
}

export type InvoiceDocKind = "RE" | "BR";

/** Fortlaufende Nummer aus SQLite (`BEGIN IMMEDIATE`); Offline/Fehler → clientseitiger Fallback. */
export async function allocateInvoiceDocumentNumber(kind: InvoiceDocKind, ymd: string): Promise<string> {
    return tauriInvoke<string>("allocate_invoice_document_number", { kind, ymd });
}

export async function allocateRechnungsnummer(
    ymd: string,
    fallback?: InvoiceNumberOpts,
): Promise<string> {
    try {
        return await allocateInvoiceDocumentNumber("RE", ymd);
    } catch {
        return nextRechnungsnummer(ymd, fallback);
    }
}

export async function allocateBerichtNummer(
    ymd: string,
    fallback?: InvoiceNumberOpts,
): Promise<string> {
    try {
        return await allocateInvoiceDocumentNumber("BR", ymd);
    } catch {
        return nextBerichtNummer(ymd, fallback);
    }
}

/** FA-FIN-INVOICE: PDF bytes from the Rust print engine. */
export async function renderInvoicePdf(invoice: InvoiceInput): Promise<Uint8Array> {
    const raw = await tauriInvoke<number[]>("render_invoice_pdf", { invoice });
    return new Uint8Array(raw);
}
