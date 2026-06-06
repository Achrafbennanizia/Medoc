import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { Select } from "./ui/input";
import { ExportIcon } from "@/lib/icons";
import {
    exportReportBundle,
    finanzenTransactionsToLegacyCsv,
    type FinanzTxRow,
    type ReportBundle,
    type ReportExportFormat,
} from "@/lib/report-export";
import { importReportAndPreview } from "@/lib/report-import";
import { useToastStore } from "./ui/toast-store";
import { errorMessage } from "@/lib/utils";
import { finishExportWithSettings } from "@/lib/export";

const FORMAT_OPTS: { value: ReportExportFormat; label: string }[] = [
    { value: "pdf", label: "PDF (Druck / Speichern)" },
    { value: "csv", label: "CSV (Tabelle)" },
    { value: "json", label: "JSON (strukturiert)" },
    { value: "xml", label: "XML (Austausch)" },
];

export type ReportExportToolbarProps = {
    /** Builds the report bundle at export time (may fetch from backend). */
    buildBundle: () => ReportBundle | null | Promise<ReportBundle | null>;
    /** Initial format; PDF is default for income/finance reports. */
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
 * Consistent export toolbar for Statistik, Bilanz, Finanzen, Compliance, Audit.
 * Uses the same format options and preview flow as Akte / clinical exports.
 */
export function ReportExportToolbar({
    buildBundle,
    defaultFormat = "pdf",
    disabled = false,
    className,
    showImport = false,
    legacyCsv,
}: ReportExportToolbarProps) {
    const toast = useToastStore((s) => s.add);
    const [format, setFormat] = useState<ReportExportFormat>(defaultFormat);
    const [busy, setBusy] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);

    const runExport = async () => {
        setBusy(true);
        try {
            const bundle = await Promise.resolve(buildBundle());
            if (!bundle) {
                toast("Keine Exportdaten.", "error");
                return;
            }
            if (format === "csv" && legacyCsv) {
                await finishExportWithSettings({
                    format: "csv",
                    title: bundle.exportTitle,
                    hint: "Komma-getrennt (UTF-8 BOM) für Excel.",
                    suggestedFilename: `${bundle.suggestedBasename}.csv`,
                    mime: "text/csv;charset=utf-8",
                    textBody: finanzenTransactionsToLegacyCsv(legacyCsv.rows, legacyCsv.patientNames),
                });
                return;
            }
            await exportReportBundle(bundle, format);
        } catch (e) {
            toast(`Export fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    const onImportFile = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true);
        try {
            await importReportAndPreview(file, format === "pdf" ? "pdf" : format);
            toast("Bericht importiert.", "success");
        } catch (e) {
            toast(`Import fehlgeschlagen: ${errorMessage(e)}`, "error");
        } finally {
            setBusy(false);
            if (importRef.current) importRef.current.value = "";
        }
    };

    return (
        <div
            className={["page-toolbar__filters row", className].filter(Boolean).join(" ")}
            style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}
        >
            <Select
                id="report-export-format"
                label=""
                aria-label="Exportformat"
                value={format}
                onChange={(e) => setFormat(e.target.value as ReportExportFormat)}
                options={FORMAT_OPTS}
                style={{ minWidth: 180 }}
            />
            <Button type="button" variant="secondary" onClick={() => void runExport()} loading={busy} disabled={disabled || busy}>
                <ExportIcon size={14} /> Exportieren
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
                        disabled={disabled || busy}
                        onClick={() => importRef.current?.click()}
                    >
                        Importieren…
                    </Button>
                </>
            ) : null}
        </div>
    );
}
