import type { Payment } from "@/models/types";
import type { DocumentKind } from "@/lib/document-template-schema";
import {
    bundleReceiptExport,
    suggestReceiptExportBasename,
    type ClinicalDocumentExportBundle,
} from "@/lib/document-print-html";
import { translateLocale } from "@/lib/i18n";
import { documentLocaleForI18n } from "@/lib/document-locale";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import { checkPracticeDocumentReadiness, type PracticeReadinessResult } from "@/lib/practice-completeness";
import { getChart, listTreatments, listExaminations } from "@/systems/practice-host/controllers/chart.controller";
import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import { listTreatmentCatalog } from "@/systems/practice-host/controllers/practice.controller";
import { listServices } from "@/systems/practice-host/controllers/service-item.controller";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";

export type ReceiptExportPayload = {
    kind: HtmlExportDocumentKind;
    bundle: ClinicalDocumentExportBundle;
    suggestedBasename: string;
    exportPreviewTitle: string;
};

/** Payment states for which a receipt may be issued (server enforces the same). */
export const RECEIPT_PAYMENT_STATUSES = ["PAID", "PARTIALLY_PAID"] as const;

export function receiptPracticeReadiness(): PracticeReadinessResult {
    return checkPracticeDocumentReadiness(getInvoicePracticeFromStorage(), "receipt");
}

export function isReceiptExportReady(): boolean {
    return receiptPracticeReadiness().ready;
}

export function canIssueReceipt(z: Pick<Payment, "status">): boolean {
    return (RECEIPT_PAYMENT_STATUSES as readonly string[]).includes(z.status);
}

/**
 * GAP-11 — receipt bundle for a payment. No number is allocated here: the
 * server assigns one QU number per payment when the receipt is issued and
 * returns a "KOPIE" with the same number on every later print.
 */
export async function buildReceiptExportForPayment(z: Payment): Promise<ReceiptExportPayload> {
    if (!isReceiptExportReady()) {
        throw new Error("Practice master data incomplete for receipts");
    }
    if (!canIssueReceipt(z)) {
        throw new Error("A receipt can only be issued for a paid payment");
    }
    const patient = await getPatient(z.patient_id);
    const chart = await getChart(z.patient_id);
    const [treatments, examinations, catalog, services] = await Promise.all([
        listTreatments(chart.id),
        listExaminations(chart.id),
        listTreatmentCatalog().catch(() => []),
        listServices().catch(() => []),
    ]);
    return {
        kind: "receipt",
        bundle: bundleReceiptExport(z, patient, treatments, examinations, catalog, services),
        suggestedBasename: suggestReceiptExportBasename(z),
        exportPreviewTitle: translateLocale(documentLocaleForI18n(), "document.print.receipt_title"),
    };
}

export const RECEIPT_DOCUMENT_KIND: DocumentKind = "receipt";
