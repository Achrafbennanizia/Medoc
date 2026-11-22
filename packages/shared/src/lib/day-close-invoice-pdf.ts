import {
    dayCloseReportCopy,
    type DayCloseProtocol,
} from "@/systems/practice-host/controllers/day-close-protocol.controller";
import { issuedPdfBytes } from "@/systems/practice-host/controllers/document.controller";
import { openExportPreview } from "@/models/store/export-preview-store";
import { t } from "@/lib/i18n";

/**
 * Cash report of a recorded closing. Opens the shared Export Preview dialog
 * (same window as the rest of the app). Figures are never assembled in the browser.
 */
export async function downloadDayCloseReportPdf(row: DayCloseProtocol, ..._legacy: unknown[]): Promise<void> {
    const issued = await dayCloseReportCopy(row.id);
    openExportPreview({
        format: "pdf",
        title: `${t("page.day_close.report_title")} ${issued.documentNumber ?? ""}`.trim(),
        hint: issued.reprint ? t("page.day_close.pdf_hint_copy") : undefined,
        suggestedFilename: `${t("page.day_close.pdf_filename")}-${row.as_of_date}-${t("page.day_close.pdf_file_copy")}.pdf`,
        binaryBody: issuedPdfBytes(issued),
        context: {
            kind: "daily_report",
            format: "pdf",
            entityId: row.as_of_date,
            documentNumber: issued.documentNumber,
        },
    });
}
