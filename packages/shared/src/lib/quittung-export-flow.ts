import type { Zahlung } from "@/models/types";
import type { DocumentKind } from "@/lib/document-template-schema";
import {
    bundleQuittungExport,
    suggestQuittungExportBasename,
    type ClinicalDocumentExportBundle,
} from "@/lib/document-print-html";
import { getInvoicePraxisFromStorage } from "@/lib/invoice-leistung";
import { checkPraxisDocumentReadiness, type PraxisReadinessResult } from "@/lib/praxis-completeness";
import { zahlungLocalYmd } from "@/lib/tagesabschluss";
import { getAkte, listBehandlungen, listUntersuchungen } from "@/systems/practice-host/controllers/akte.controller";
import { allocateQuittungNummer } from "@/systems/practice-host/controllers/invoice.controller";
import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";

export type QuittungExportPayload = {
    kind: HtmlExportDocumentKind;
    bundle: ClinicalDocumentExportBundle;
    suggestedBasename: string;
    exportPreviewTitle: string;
};

export function quittungPraxisReadiness(): PraxisReadinessResult {
    return checkPraxisDocumentReadiness(getInvoicePraxisFromStorage(), "quittung");
}

export function isQuittungExportReady(): boolean {
    return quittungPraxisReadiness().ready;
}

/** GAP-11 — shared Quittung PDF bundle from any Zahlung row (Finanzen or Patientenakte). */
export async function buildQuittungExportForZahlung(z: Zahlung): Promise<QuittungExportPayload> {
    if (!isQuittungExportReady()) {
        throw new Error("Practice master data incomplete for receipts");
    }
    const patient = await getPatient(z.patient_id);
    const akte = await getAkte(z.patient_id);
    const [behandlungen, untersuchungen] = await Promise.all([
        listBehandlungen(akte.id),
        listUntersuchungen(akte.id),
    ]);
    const receiptNumber = await allocateQuittungNummer(zahlungLocalYmd(z.created_at));
    return {
        kind: "quittung",
        bundle: bundleQuittungExport(z, patient, behandlungen, untersuchungen, receiptNumber),
        suggestedBasename: suggestQuittungExportBasename(z),
        exportPreviewTitle: `Quittung — ${patient.name}`,
    };
}

export const QUITTUNG_DOCUMENT_KIND: DocumentKind = "quittung";
