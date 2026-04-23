import { tauriInvoke } from "@/services/tauri.service";

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

/** FA-FIN-INVOICE: PDF bytes from the Rust print engine. */
export async function renderInvoicePdf(invoice: InvoiceInput): Promise<Uint8Array> {
    const raw = await tauriInvoke<number[]>("render_invoice_pdf", { invoice });
    return new Uint8Array(raw);
}
