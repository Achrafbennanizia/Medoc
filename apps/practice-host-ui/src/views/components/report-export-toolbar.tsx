import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { ExportIcon } from "@/lib/icons";
import {
    type FinanzTxRow,
    type ReportBundle,
    type ReportExportFormat,
} from "@/lib/report-export";
import { importReportAndPreview } from "@/lib/report-import";
import { useToastStore } from "./ui/toast-store";
import { errorMessage } from "@/lib/utils";
import { useT, useTParams } from "@/lib/i18n";
import { ReportExportPickerDialog } from "./report-export-picker-dialog";

export type ReportExportToolbarProps = {
    /** Builds the report bundle at export time (may fetch from backend). */
    buildBundle: () => ReportBundle | null | Promise<ReportBundle | null>;
    /** Dialog title, e.g. „Export — Statistik“. */
    dialogTitle: string;
    /** Initial format in the export dialog. */
    defaultFormat?: ReportExportFormat;
    disabled?: boolean;
    className?: string;
    /** Show import button for round-trip JSON/XML reports. */
    showImport?: boolean;
    /**
     * When set with format `csv`, export legacy comma-separated transactions
     * (Finanzen Excel compatibility) instead of semicolon report CSV.
     */
    legacyCsv?: {
        rows: FinanzTxRow[];
        patientNames: Map<string, string>;
    };
};

/**
 * Export entry for Statistik, Bilanz, Finanzen, Compliance, Audit.
 * Opens the same picker dialog pattern as Patientenakte export.
 */
export function ReportExportToolbar({
    buildBundle,
    dialogTitle,
    defaultFormat = "pdf",
    disabled = false,
    className,
    showImport = false,
    legacyCsv,
}: ReportExportToolbarProps) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const [pickerOpen, setPickerOpen] = useState(false);
    const [importBusy, setImportBusy] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);

    const onImportFile = async (file: File | undefined) => {
        if (!file) return;
        setImportBusy(true);
        try {
            await importReportAndPreview(file, "json");
            toast(t("export.report.import_ok"), "success");
        } catch (e) {
            toast(tp("export.report.import_failed", { message: errorMessage(e) }), "error");
        } finally {
            setImportBusy(false);
            if (importRef.current) importRef.current.value = "";
        }
    };

    return (
        <>
            <div
                className={["page-toolbar__filters row", className].filter(Boolean).join(" ")}
                style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}
            >
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setPickerOpen(true)}
                    loading={importBusy}
                    disabled={disabled || importBusy}
                >
                    <ExportIcon size={14} /> {t("export.report.export_btn")}
                </Button>
                {showImport ? (
                    <>
                        <input
                            ref={importRef}
                            type="file"
                            accept=".json,.xml,application/json,text/xml"
                            className="sr-only"
                            aria-hidden
                            onChange={(e) => void onImportFile(e.target.files?.[0])}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={disabled || importBusy}
                            onClick={() => importRef.current?.click()}
                        >
                            {t("export.report.import_btn")}
                        </Button>
                    </>
                ) : null}
            </div>
            <ReportExportPickerDialog
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                title={dialogTitle}
                buildBundle={buildBundle}
                defaultFormat={defaultFormat}
                legacyCsv={legacyCsv}
            />
        </>
    );
}
