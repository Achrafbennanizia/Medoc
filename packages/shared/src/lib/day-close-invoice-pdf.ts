import {
    dayCloseReportCopy,
    type DayCloseProtocol,
} from "@/systems/practice-host/controllers/day-close-protocol.controller";
import { issuedPdfBytes } from "@/systems/practice-host/controllers/document.controller";
import { openExportPreview } from "@/models/store/export-preview-store";

/**
 * Kassenbericht of a recorded closing. The report is built and numbered on
 * the server when the day is closed (`closeDay`); this opens a copy
 * ("KOPIE", same TB number). Figures are never assembled in the browser.
 *
 * The extra parameters of the old signature are accepted and ignored.
 */
export async function downloadDayCloseReportPdf(row: DayCloseProtocol, ..._legacy: unknown[]): Promise<void> {
    const issued = await dayCloseReportCopy(row.id);
    openExportPreview({
        format: "pdf",
        title: `Kassenbericht ${issued.documentNumber ?? ""}`.trim(),
        hint: "KOPIE",
        suggestedFilename: `Kassenbericht-${row.as_of_date}-Kopie.pdf`,
        binaryBody: issuedPdfBytes(issued),
        context: { kind: "daily_report", format: "pdf", entityId: row.as_of_date, documentNumber: issued.documentNumber },
    });
}
