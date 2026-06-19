import { useT, useTParams } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import { useToastStore } from "./ui/toast-store";
import { describeResolvedExportPath, loadExportPathConfig, type ExportPathConfigV1 } from "@/lib/export-settings";
import { pickExportDirectory } from "@/systems/practice-host/controllers/document-template.controller";
import { finishExportWithSettings } from "@/lib/export";
import { isTauriApp } from "@/lib/save-download";
import { parseDelimitedGrid } from "@/lib/export-delimited";
import {
    buildReportPdfBytes,
    finanzenTransactionsToLegacyCsv,
    reportBundleToCsv,
    reportBundleToJson,
    reportBundleToXml,
    reportFilename,
    type FinanzTxRow,
    type ReportBundle,
    type ReportExportFormat,
} from "@/lib/report-export";
import { errorMessage } from "@/lib/utils";

const REPORT_FORMAT_OPTS = (t: (key: string) => string): { value: ReportExportFormat; label: string }[] => [
    { value: "pdf", label: t("export.picker.format_pdf") },
    { value: "csv", label: t("export.picker.format_csv") },
    { value: "json", label: t("export.report.format_json") },
    { value: "xml", label: t("export.report.format_xml") },
];

export type ReportExportPickerDialogProps = {
    open: boolean;
    onClose: () => void;
    /** Dialog title, e.g. „Export — Statistik“. */
    title: string;
    buildBundle: () => ReportBundle | null | Promise<ReportBundle | null>;
    defaultFormat?: ReportExportFormat;
    legacyCsv?: {
        rows: FinanzTxRow[];
        patientNames: Map<string, string>;
    };
};

function filenameWithFormat(name: string, format: ReportExportFormat): string {
    const base = name.trim().replace(/\.(pdf|csv|json|xml)$/i, "");
    return `${base || "export"}.${format}`;
}

export function ReportExportPickerDialog({
    open,
    onClose,
    title,
    buildBundle,
    defaultFormat = "pdf",
    legacyCsv,
}: ReportExportPickerDialogProps) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const [format, setFormat] = useState<ReportExportFormat>(defaultFormat);
    const [fileName, setFileName] = useState("");
    const [busy, setBusy] = useState(false);
    const [bundle, setBundle] = useState<ReportBundle | null>(null);
    const [bundleLoading, setBundleLoading] = useState(false);
    const [pathCfg, setPathCfg] = useState<ExportPathConfigV1 | null>(null);
    const [folderOnce, setFolderOnce] = useState<string | null>(null);
    const [useLegacyCsv, setUseLegacyCsv] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewBusy, setPreviewBusy] = useState(false);
    const previewUrlRef = useRef<string | null>(null);

    const resolvedPathLabel = useMemo(() => {
        if (folderOnce?.trim()) return folderOnce.trim();
        if (pathCfg) return describeResolvedExportPath(pathCfg);
        return "…";
    }, [folderOnce, pathCfg]);

    const revokePreview = useCallback(() => {
        const u = previewUrlRef.current;
        if (u?.startsWith("blob:")) {
            try {
                URL.revokeObjectURL(u);
            } catch {
                /* ignore */
            }
        }
        previewUrlRef.current = null;
        setPreviewUrl(null);
    }, []);

    useEffect(() => {
        if (!open) return;
        void (async () => {
            try {
                const p = await loadExportPathConfig();
                setPathCfg(p);
            } catch {
                setPathCfg({ mode: "documents", customPath: "" });
            }
        })();
    }, [open]);

    useEffect(() => {
        if (!open) {
            setBundle(null);
            setFormat(defaultFormat);
            setFileName("");
            setFolderOnce(null);
            setUseLegacyCsv(false);
            revokePreview();
            return;
        }
        let cancelled = false;
        setBundleLoading(true);
        void (async () => {
            try {
                const b = await Promise.resolve(buildBundle());
                if (cancelled) return;
                setBundle(b);
                if (b) setFileName(reportFilename(b, defaultFormat));
            } catch (e) {
                if (!cancelled) {
                    toast(tp("export.picker.load_failed", { message: errorMessage(e) }), "error");
                    setBundle(null);
                }
            } finally {
                if (!cancelled) setBundleLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, buildBundle, defaultFormat, toast, revokePreview]);

    useEffect(() => {
        if (!open || !bundle) return;
        setFileName(reportFilename(bundle, format));
    }, [format, bundle, open]);

    useEffect(() => {
        if (!open) {
            revokePreview();
            return;
        }
        if (format !== "pdf" || !bundle) {
            revokePreview();
            return;
        }
        const t = window.setTimeout(() => {
            void (async () => {
                setPreviewBusy(true);
                try {
                    const bytes = await buildReportPdfBytes(bundle);
                    const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
                    revokePreview();
                    const url = URL.createObjectURL(blob);
                    previewUrlRef.current = url;
                    setPreviewUrl(url);
                } catch (e) {
                    toast(tp("export.picker.preview_error", { message: errorMessage(e) }), "error");
                    revokePreview();
                } finally {
                    setPreviewBusy(false);
                }
            })();
        }, 420);
        return () => window.clearTimeout(t);
    }, [open, format, bundle, toast, revokePreview]);

    const csvPreviewRows = useMemo(() => {
        if (!bundle || format !== "csv") return [] as string[][];
        const text =
            legacyCsv && useLegacyCsv
                ? finanzenTransactionsToLegacyCsv(legacyCsv.rows, legacyCsv.patientNames)
                : reportBundleToCsv(bundle);
        return parseDelimitedGrid(text).rows.slice(0, 40);
    }, [bundle, format, legacyCsv, useLegacyCsv]);

    const textPreview = useMemo(() => {
        if (!bundle) return "";
        if (format === "json") return reportBundleToJson(bundle);
        if (format === "xml") return reportBundleToXml(bundle);
        return "";
    }, [bundle, format]);

    const runExport = async () => {
        if (!bundle) {
            toast(t("common.no_export_data"), "error");
            return;
        }
        const finalName = filenameWithFormat(fileName, format);
        const destFolder = folderOnce?.trim() || null;

        setBusy(true);
        try {
            if (format === "csv" && legacyCsv && useLegacyCsv) {
                await finishExportWithSettings({
                    format: "csv",
                    title: bundle.exportTitle,
                    hint: "Komma-getrennt (UTF-8 BOM) für Excel.",
                    suggestedFilename: finalName,
                    mime: "text/csv;charset=utf-8",
                    textBody: finanzenTransactionsToLegacyCsv(legacyCsv.rows, legacyCsv.patientNames),
                    folderOverride: destFolder,
                });
            } else if (format === "pdf") {
                const bytes = await buildReportPdfBytes(bundle);
                await finishExportWithSettings({
                    format: "pdf",
                    title: bundle.exportTitle,
                    hint: bundle.hint,
                    suggestedFilename: finalName,
                    mime: "application/pdf",
                    binaryBody: bytes,
                    folderOverride: destFolder,
                });
            } else if (format === "csv") {
                await finishExportWithSettings({
                    format: "csv",
                    title: bundle.exportTitle,
                    hint: bundle.hint,
                    suggestedFilename: finalName,
                    mime: "text/csv;charset=utf-8",
                    textBody: reportBundleToCsv(bundle),
                    folderOverride: destFolder,
                });
            } else if (format === "json") {
                await finishExportWithSettings({
                    format: "json",
                    title: bundle.exportTitle,
                    hint: bundle.hint,
                    suggestedFilename: finalName,
                    mime: "application/json;charset=utf-8",
                    textBody: reportBundleToJson(bundle),
                    folderOverride: destFolder,
                });
            } else {
                await finishExportWithSettings({
                    format: "xml",
                    title: bundle.exportTitle,
                    hint: bundle.hint,
                    suggestedFilename: finalName,
                    mime: "application/xml;charset=utf-8",
                    textBody: reportBundleToXml(bundle),
                    folderOverride: destFolder,
                });
            }
            onClose();
        } catch (e) {
            toast(tp("common.export_failed", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={title}
            className="modal--akte-export modal--wide"
            footer={(
                <>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                        {t("common.cancel")}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void runExport()}
                        loading={busy}
                        disabled={busy || bundleLoading || !bundle}
                    >
                        {t("common.export_action")}
                    </Button>
                </>
            )}
        >
            <div className="akte-export-dialog-layout">
                <div className="akte-export-dialog-form-col">
                    <p className="text-body text-on-surface-variant" style={{ margin: 0, fontSize: 13 }}>
                        {t("export.report.hint")}
                    </p>
                    <Select
                        id="report-export-picker-format"
                        label={t("export.picker.format")}
                        value={format}
                        onChange={(e) => setFormat(e.target.value as ReportExportFormat)}
                        options={REPORT_FORMAT_OPTS(t)}
                    />
                    {legacyCsv && format === "csv" ? (
                        <label className="row" style={{ gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                            <input
                                type="checkbox"
                                checked={useLegacyCsv}
                                onChange={(e) => setUseLegacyCsv(e.target.checked)}
                            />
                            <span className="text-body" style={{ fontSize: 13 }}>
                                {t("export.report.legacy_csv")}
                            </span>
                        </label>
                    ) : null}
                    <div>
                        <div className="text-label" style={{ marginBottom: 8 }}>{t("export.picker.target_path")}</div>
                        <p className="text-body" style={{ margin: "0 0 8px", fontSize: 12, wordBreak: "break-word" }}>
                            {resolvedPathLabel}
                        </p>
                        {isTauriApp() ? (
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={async () => {
                                    const p = await pickExportDirectory();
                                    if (p) setFolderOnce(p);
                                }}
                            >
                                {t("export.picker.another_folder")}
                            </Button>
                        ) : null}
                    </div>
                    <div>
                        <div className="text-label" style={{ marginBottom: 8 }}>{t("export.picker.filename")}</div>
                        <Input
                            id="report-export-picker-filename"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            className="input-edit"
                            autoComplete="off"
                        />
                    </div>
                </div>
                <div className="akte-export-dialog-preview-col">
                    <div className="text-label">{t("common.preview")}</div>
                    <div className="akte-export-pdf-preview-box">
                        {bundleLoading ? (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>{t("common.loading_data")}</p>
                        ) : !bundle ? (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>{t("common.no_export_data")}</p>
                        ) : format === "pdf" ? (
                            previewBusy ? (
                                <p className="card-pad card-sub" style={{ margin: 0 }}>{t("export.picker.pdf_generating")}</p>
                            ) : previewUrl ? (
                                <iframe title={t("export.report.pdf_preview_title")} src={previewUrl} />
                            ) : (
                                <p className="card-pad card-sub" style={{ margin: 0 }}>{t("export.picker.pdf_preparing")}</p>
                            )
                        ) : format === "csv" && csvPreviewRows.length > 0 ? (
                            <div className="export-preview-scroll" style={{ maxHeight: 420, overflow: "auto" }}>
                                <table className="tbl export-preview-tbl" style={{ fontSize: 12 }}>
                                    <tbody>
                                        {csvPreviewRows.map((row, ri) => (
                                            <tr key={ri}>
                                                {row.map((c, ci) => (
                                                    <td key={ci}>{ri === 0 ? <strong>{c}</strong> : c}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : format === "csv" ? (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>{t("common.no_csv_rows")}</p>
                        ) : (
                            <pre
                                className="card card-pad export-preview-pre"
                                style={{ margin: 0, maxHeight: 420, overflow: "auto", fontSize: 12 }}
                            >
                                {textPreview}
                            </pre>
                        )}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}
