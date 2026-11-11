import { issueInvoice, pdfBase64ToBytes } from "@/systems/practice-host/controllers/document.controller";

/** GOZ / GOÄ fee lines, § 9 expenses (material, external lab), other items. */
export type FeeSchedule = "goz" | "goae" | "material" | "lab" | "other";

export interface InvoiceLineInput {
    description: string;
    /** Net line amount in cents. The server recomputes fee lines from points × Punktwert × factor. */
    amount_cents: number;
    fee_schedule?: FeeSchedule;
    /** Points of the GOZ/GOÄ number — required for fee lines. */
    points?: number | null;
    /** § 6 Abs. 1 GOZ analog billing: number of the service the fee is taken from. */
    analog_of?: string | null;
    /** § 2 Abs. 1/2 GOZ agreement reference (factor > 3.5). */
    agreement_ref?: string | null;
    /** Receipt for an expense above 25,56 EUR is attached. */
    receipt_attached?: boolean;
    goz_nr?: string | null;
    factor?: number | null;
    unit_price_cents?: number | null;
    quantity?: number | null;
    tooth_nr?: string | null;
    treatment_date?: string | null;
    vat_percent?: number | null;
    material?: string | null;
    diagnosis_reason?: string | null;
    /** Billed record: `treatment:<id>` / `examination:<id>`. The server refuses
     *  a record that is already on an open invoice and matches payments to it. */
    source_ref?: string | null;
}

export interface InvoiceInput {
    /** Set by the server when the invoice is issued — leave empty. */
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
    /** UI locale for letterhead chrome (`en`|`de`|`fr`|`ar`). */
    locale?: string | null;
    /** Arabic: logo on the top-right. */
    rtl?: boolean | null;
    /** Treated person — filled by the server from the patient record. */
    patient_name?: string;
    patient_birth_date?: string | null;
    /** Set by the server (invoice date + payment term). */
    due_date?: string | null;
}

/*
 * allocateInvoiceDocumentNumber / allocateInvoiceNumber / allocateReceiptNumber /
 * allocateReportNumber were removed. Numbers are allocated by the server in the
 * same transaction that stores the document (issue_invoice, issue_clinical_document,
 * issue_report_pdf), so a cancelled dialog can no longer burn a number.
 */

/** Draft PDF (watermark "ENTWURF", no number). */
export async function renderInvoicePdf(patientId: string, invoice: InvoiceInput): Promise<Uint8Array> {
    const out = await issueInvoice(patientId, invoice, true);
    return pdfBase64ToBytes(out.pdfBase64);
}
