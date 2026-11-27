/** Practice master-data checks and money conversion for invoices. */
import type { InvoicePractice } from "./invoice-service-item";
import { roundMoney2 } from "@/lib/payment-booking";

/** ZANR / BSNR: exactly 9 digits (no spaces). */
export function isValidPracticeDigitId(value: string): boolean {
    return value.replace(/\D/g, "").length === 9;
}

/** IBAN: DE + 20 digits or general ISO format. */
export function isValidPracticeIban(value: string): boolean {
    const s = value.replace(/\s/g, "").toUpperCase();
    if (!s) return false;
    if (s.startsWith("DE")) return /^DE\d{20}$/.test(s);
    return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s);
}

/** Required fields for invoices/prescriptions per practice master data. */
export function practiceInvoiceRequiredMissing(p: InvoicePractice): boolean {
    return (
        !(p.clinician_name ?? "").trim() ||
        !(p.zanr ?? "").trim() ||
        !(p.bsnr ?? "").trim() ||
        !(p.bank_iban ?? "").trim()
    );
}

/** Invoice PDF and save: current privacy setting from device. */
export function moneyToInvoiceCents(bruto: number): number {
    // No rounding up to 1 ct: an invoice line must equal the computed fee.
    return Math.round(roundMoney2(bruto) * 100);
}

/*
 * Client-side invoice/report numbers (random RE-/BR- suffixes) were removed:
 * GoBD needs gap-free, unique numbers, which only the server can guarantee
 * (`issue_invoice`, `issue_report_pdf`, MASTER device only).
 */
