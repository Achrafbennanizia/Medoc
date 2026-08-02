import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import {
    nextBerichtNummer,
    nextRechnungsnummer,
    type InvoiceNumberOpts,
} from "@/lib/invoice-leistung";

export interface InvoiceLineInput {
    description: string;
    amount_cents: number;
    goz_nr?: string | null;
    faktor?: number | null;
    einzelpreis_cents?: number | null;
    menge?: number | null;
    zahn_nr?: string | null;
    behandlungsdatum?: string | null;
    ust_prozent?: number | null;
    material?: string | null;
    diagnose_begruendung?: string | null;
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
    behandler_name?: string | null;
    behandler_zanr?: string | null;
    praxis_bsnr?: string | null;
    bankverbindung?: string[] | null;
    zahlungsziel_text?: string | null;
    ust_hinweis?: string | null;
}

export type InvoiceDocKind = "RE" | "BR" | "QU";

export async function allocateQuittungNummer(ymd: string): Promise<string> {
    return allocateInvoiceDocumentNumber("QU", ymd);
}

/** Sequential number from SQLite (`BEGIN IMMEDIATE`); offline/error → client-side fallback. */
export async function allocateInvoiceDocumentNumber(kind: InvoiceDocKind, ymd: string): Promise<string> {
    return practiceSystem.invoke<string>("allocate_invoice_document_number", { kind, ymd });
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
    const raw = await practiceSystem.invoke<number[]>("render_invoice_pdf", { invoice });
    return new Uint8Array(raw);
}
