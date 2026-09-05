import type { Payment } from "@/models/types";
import type { DocumentKind } from "@/lib/document-template-schema";
import {
    bundleReceiptExport,
    suggestReceiptExportBasename,
    type ClinicalDocumentExportBundle,
} from "@/lib/document-print-html";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import { checkPracticeDocumentReadiness, type PracticeReadinessResult } from "@/lib/practice-completeness";
import { paymentLocalYmd } from "@/lib/day-close";
import { getChart, listTreatments, listExaminations } from "@/systems/practice-host/controllers/chart.controller";
import { allocateReceiptNumber } from "@/systems/practice-host/controllers/invoice.controller";
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

export function receiptPracticeReadiness(): PracticeReadinessResult {
    return checkPracticeDocumentReadiness(getInvoicePracticeFromStorage(), "receipt");
}

export function isReceiptExportReady(): boolean {
    return receiptPracticeReadiness().ready;
}

/** GAP-11 — shared Receipt PDF bundle from any Payment row (Finance or PatientChart). */
export async function buildReceiptExportForPayment(z: Payment): Promise<ReceiptExportPayload> {
    if (!isReceiptExportReady()) {
        throw new Error("Practice master data incomplete for receipts");
    }
    const patient = await getPatient(z.patient_id);
    const chart = await getChart(z.patient_id);
    const [treatments, examinations, catalog, services] = await Promise.all([
        listTreatments(chart.id),
        listExaminations(chart.id),
        listTreatmentCatalog().catch(() => []),
        listServices().catch(() => []),
    ]);
    const receiptNumber = await allocateReceiptNumber(paymentLocalYmd(z.created_at));
    return {
        kind: "receipt",
        bundle: bundleReceiptExport(
            z,
            patient,
            treatments,
            examinations,
            receiptNumber,
            catalog,
            services,
        ),
        suggestedBasename: suggestReceiptExportBasename(z),
        exportPreviewTitle: `Receipt — ${patient.name}`,
    };
}

export const RECEIPT_DOCUMENT_KIND: DocumentKind = "receipt";
