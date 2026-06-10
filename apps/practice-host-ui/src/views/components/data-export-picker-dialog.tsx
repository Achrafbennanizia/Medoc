import { useEffect, useMemo, useState } from "react";
import type { ExportFormat } from "@/models/store/export-preview-store";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import { useToastStore } from "./ui/toast-store";
import { describeResolvedExportPath, loadExportPathConfig, type ExportPathConfigV1 } from "@/lib/export-settings";
import { pickExportDirectory } from "@/systems/practice-host/controllers/document-template.controller";
import { finishExportWithSettings } from "@/lib/export";
import { isTauriApp } from "@/lib/save-download";
import { parseDelimitedGrid } from "@/lib/export-delimited";
import { errorMessage } from "@/lib/utils";

export type DataExportFormat = Extract<ExportFormat, "csv" | "json" | "zip">;

export type DataExportPayload = {
    exportTitle: string;
    hint?: string;
    suggestedFilename: string;
    textBody?: string;
    binaryBody?: Uint8Array;
    mime?: string;
};

export type DataExportPickerDialogProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    formats: { value: DataExportFormat; label: string }[];
    defaultFormat: DataExportFormat;
    resolvePayload: (format: DataExportFormat) => Promise<DataExportPayload | null> | DataExportPayload | null;
};

function filenameWithExt(name: string, format: DataExportFormat): string {
    const base = name.trim().replace(/\.(csv|json|zip)$/i, "");
    return `${base || "export"}.${format}`;
}

export function DataExportPickerDialog({
    open,
    onClose,
    title,
    description = "Format und Speicherort vor dem Export.",
    formats,
    defaultFormat,
    resolvePayload,
}: DataExportPickerDialogProps) {
    const toast = useToastStore((s) => s.add);
    const [format, setFormat] = useState<DataExportFormat>(defaultFormat);
    const [fileName, setFileName] = useState("");
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(false);
    const [payload, setPayload] = useState<DataExportPayload | null>(null);
    const [pathCfg, setPathCfg] = useState<ExportPathConfigV1 | null>(null);
    const [folderOnce, setFolderOnce] = useState<string | null>(null);
    const resolvedPathLabel = useMemo(() => {
        if (folderOnce?.trim()) return folderOnce.trim();
        if (pathCfg) return describeResolvedExportPath(pathCfg);
        return "…";
    }, [folderOnce, pathCfg]);

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
            setPayload(null);
            setFormat(defaultFormat);
            setFileName("");
            setFolderOnce(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        void (async () => {
            try {
                const p = await Promise.resolve(resolvePayload(format));
                if (cancelled) return;
                setPayload(p);
                if (p) setFileName(p.suggestedFilename);
            } catch (e) {
                if (!cancelled) {
                    toast(`Daten laden fehlgeschlagen: ${errorMessage(e)}`, "error");
                    setPayload(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, format, resolvePayload, defaultFormat, toast]);

    const csvPreviewRows = useMemo(() => {
        if (!payload?.textBody || format !== "csv") return [] as string[][];
        return parseDelimitedGrid(payload.textBody).rows.slice(0, 40);
    }, [payload, format]);

    const runExport = async () => {
        if (!payload) {
            toast("Keine Exportdaten.", "error");
            return;
        }
        const finalName = filenameWithExt(fileName, format);
        const destFolder = folderOnce?.trim() || null;
        setBusy(true);
        try {
            await finishExportWithSettings({
                format,
                title: payload.exportTitle,
                hint: payload.hint,
                suggestedFilename: finalName,
                mime: payload.mime ?? "application/octet-stream",
                textBody: payload.textBody,
                binaryBody: payload.binaryBody,
                folderOverride: destFolder,
            });
            onClose();
        } catch (e) {
            toast(`Export fehlgeschlagen: ${errorMessage(e)}`, "error");
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
                        Abbrechen
                    </Button>
                    <Button type="button" onClick={() => void runExport()} loading={busy} disabled={busy || loading || !payload}>
                        Exportieren
                    </Button>
                </>
            )}
        >
            <div className="akte-export-dialog-layout">
                <div className="akte-export-dialog-form-col">
                    <p className="text-body text-on-surface-variant" style={{ margin: 0, fontSize: 13 }}>
                        {description}
                    </p>
                    {formats.length > 1 ? (
                        <Select
                            id="data-export-picker-format"
                            label="Dateiformat"
                            value={format}
                            onChange={(e) => setFormat(e.target.value as DataExportFormat)}
                            options={formats}
                        />
                    ) : null}
                    <div>
                        <div className="text-label" style={{ marginBottom: 8 }}>Zielpfad</div>
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
                                Anderen Speicherort wählen …
                            </Button>
                        ) : null}
                    </div>
                    <div>
                        <div className="text-label" style={{ marginBottom: 8 }}>Dateiname</div>
                        <Input
                            id="data-export-picker-filename"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            className="input-edit"
                            autoComplete="off"
                        />
                    </div>
                </div>
                <div className="akte-export-dialog-preview-col">
                    <div className="text-label">Vorschau</div>
                    <div className="akte-export-pdf-preview-box">
                        {loading ? (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>Daten werden geladen …</p>
                        ) : !payload ? (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>Keine Exportdaten.</p>
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
                        ) : format === "json" && payload.textBody ? (
                            <pre
                                className="card card-pad export-preview-pre"
                                style={{ margin: 0, maxHeight: 420, overflow: "auto", fontSize: 12 }}
                            >
                                {payload.textBody.slice(0, 12000)}
                            </pre>
                        ) : format === "zip" ? (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>
                                ZIP-Archiv ({payload.suggestedFilename}) — Inhalt wird beim Speichern bereitgestellt.
                            </p>
                        ) : (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>Keine Vorschau.</p>
                        )}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}
