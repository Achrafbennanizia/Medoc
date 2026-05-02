import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import type { Patient } from "@/models/types";
import type { ExportFormat } from "@/models/store/export-preview-store";
import { exportAktePdf } from "@/controllers/akte.controller";
import { useToastStore } from "./ui/toast-store";
import {
    AKTE_EXPORT_SECTION_META,
    type AkteExportFileFormat,
    type AkteExportSectionsState,
    buildAkteExportCsvFromInterop,
    buildAkteExportXmlInterop,
    buildInteroperableAkteJson,
    defaultAkteExportSections,
    loadAkteExportSnapshot,
    suggestAkteExportFilenames,
} from "@/lib/akte-export";
import {
    describeResolvedExportPath,
    loadExportFormatsConfig,
    loadExportPathConfig,
    defaultFormatForKind,
    type ExportFileFormat,
    type ExportFormatsConfigV1,
    type ExportPathConfigV1,
} from "@/lib/export-settings";
import {
    pickExportDirectory,
    listDokumentTemplatesForKind,
    previewDocumentPdf,
    type DokumentTemplateDto,
} from "@/controllers/document-template.controller";
import { finishExportWithSettings } from "@/lib/export";
import {
    BUILTIN_TEMPLATES_BY_KIND,
    DOCUMENT_KIND_LABEL,
    emptyDocumentTemplatePayloadV1,
    parseTemplatePayloadJson,
    type DocumentKind,
    type DocumentTemplatePayloadV1,
} from "@/lib/document-template-schema";
import { parseDelimitedGrid, stripBom } from "@/lib/export-delimited";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import { isTauriApp } from "@/lib/save-download";

export type ExportPickerAkteProps = {
    open: boolean;
    onClose: () => void;
    patientId: string;
    patient: Patient | null;
    canViewClinical: boolean;
    canReadFinanzen: boolean;
    canAuditRead: boolean;
};

/** Unified export dialog (Phase 3): Akte; weitere Dokumentarten können ergänzt werden. */
export function ExportPickerDialog(props: ExportPickerAkteProps) {
    return <AkteExportPickerInner {...props} />;
}

/** @deprecated Alias — gleiche Oberfläche wie ExportPickerDialog (Akte). */
export const AkteExportDialog = ExportPickerDialog;
export type AkteExportDialogProps = ExportPickerAkteProps;

function extForFormat(f: AkteExportFileFormat): string {
    return f;
}

function AkteExportPickerInner({
    open,
    onClose,
    patientId,
    patient,
    canViewClinical,
    canReadFinanzen,
    canAuditRead,
}: ExportPickerAkteProps) {
    const toast = useToastStore((s) => s.add);
    const [sections, setSections] = useState<AkteExportSectionsState>(() => defaultAkteExportSections());
    const [format, setFormat] = useState<AkteExportFileFormat>("pdf");
    const [fileName, setFileName] = useState("");
    const [busy, setBusy] = useState(false);
    const [pathCfg, setPathCfg] = useState<ExportPathConfigV1 | null>(null);
    const [folderOnce, setFolderOnce] = useState<string | null>(null);
    const [tplChoice, setTplChoice] = useState<string>("__default__");
    const [userTpl, setUserTpl] = useState<DokumentTemplateDto[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewBusy, setPreviewBusy] = useState(false);
    const previewUrlRef = useRef<string | null>(null);

    const builtins = BUILTIN_TEMPLATES_BY_KIND.akte;

    const filenameSuggestions = useMemo(() => {
        if (!patient) return [] as string[];
        return suggestAkteExportFilenames(patient, extForFormat(format));
    }, [patient, format]);

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
        if (!open) return;
        void (async () => {
            try {
                const rows = await listDokumentTemplatesForKind("akte");
                setUserTpl(rows);
                const def = rows.find((r) => r.isDefault);
                setTplChoice(def?.id ?? "__default__");
            } catch {
                setUserTpl([]);
            }
        })();
    }, [open]);

    useEffect(() => {
        if (!open || !patient) return;
        const d = defaultAkteExportSections();
        for (const row of AKTE_EXPORT_SECTION_META) {
            if (row.needsMedical && !canViewClinical) d[row.key] = false;
            if (row.needsFinanzen && !canReadFinanzen) d[row.key] = false;
            if (row.needsAuditRead && !canAuditRead) d[row.key] = false;
        }
        setSections(d);
        setFormat("pdf");
        setFileName(suggestAkteExportFilenames(patient, "pdf")[0]);
        setFolderOnce(null);
    }, [open, patient, canViewClinical, canReadFinanzen, canAuditRead]);

    useEffect(() => {
        if (!patient || !open) return;
        setFileName(suggestAkteExportFilenames(patient, extForFormat(format))[0]);
    }, [format, patient, open]);

    const anySelected = Object.values(sections).some(Boolean);

    const resolvedPathLabel = useMemo(() => {
        if (folderOnce?.trim()) return folderOnce.trim();
        if (pathCfg) return describeResolvedExportPath(pathCfg);
        return "…";
    }, [folderOnce, pathCfg]);

    const toggle = (key: keyof AkteExportSectionsState) => {
        setSections((p) => ({ ...p, [key]: !p[key] }));
    };

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
        if (!open) {
            revokePreview();
            return;
        }
        if (format !== "pdf" || !anySelected || !patientId) {
            revokePreview();
            return;
        }
        const secForRust: AkteExportSectionsState = { ...sections };
        for (const row of AKTE_EXPORT_SECTION_META) {
            if (row.needsMedical && !canViewClinical) secForRust[row.key] = false;
            if (row.needsFinanzen && !canReadFinanzen) secForRust[row.key] = false;
            if (row.needsAuditRead && !canAuditRead) secForRust[row.key] = false;
        }
        const t = window.setTimeout(() => {
            void (async () => {
                setPreviewBusy(true);
                try {
                    const b64 = await exportAktePdf(patientId, secForRust);
                    const bin = atob(b64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    const blob = new Blob([bytes], { type: "application/pdf" });
                    revokePreview();
                    const url = URL.createObjectURL(blob);
                    previewUrlRef.current = url;
                    setPreviewUrl(url);
                } catch (e) {
                    toast(`Vorschau: ${e instanceof Error ? e.message : String(e)}`, "error");
                    revokePreview();
                } finally {
                    setPreviewBusy(false);
                }
            })();
        }, 420);
        return () => {
            window.clearTimeout(t);
        };
    }, [
        open,
        format,
        anySelected,
        patientId,
        sections,
        canViewClinical,
        canReadFinanzen,
        canAuditRead,
        patient,
        toast,
        revokePreview,
    ]);

    const runExport = async () => {
        if (!patient) {
            toast("Keine Patientendaten geladen.", "error");
            return;
        }
        if (!anySelected) {
            toast("Bitte mindestens einen Export-Bereich auswählen.", "info");
            return;
        }

        const secForRust: AkteExportSectionsState = { ...sections };
        for (const row of AKTE_EXPORT_SECTION_META) {
            if (row.needsMedical && !canViewClinical) secForRust[row.key] = false;
            if (row.needsFinanzen && !canReadFinanzen) secForRust[row.key] = false;
            if (row.needsAuditRead && !canAuditRead) secForRust[row.key] = false;
        }

        const name = fileName.trim() || suggestAkteExportFilenames(patient, extForFormat(format))[0];
        const destFolder = folderOnce?.trim() || null;

        setBusy(true);
        try {
            if (format === "pdf") {
                const b64 = await exportAktePdf(patientId, secForRust);
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                const fn = name.endsWith(".pdf") ? name : `${name}.pdf`;
                await finishExportWithSettings({
                    format: "pdf",
                    title: "Patientenakte — Export",
                    hint:
                        tplChoice !== "__default__"
                            ? "Vorlagenwahl ist für Akten-PDF noch an die Rendering-Pipeline anzubinden."
                            : "PDF gemäß gewählter Bereiche. Anlagen nur als Metadaten.",
                    suggestedFilename: fn,
                    mime: "application/pdf",
                    binaryBody: bytes,
                    folderOverride: destFolder,
                });
            } else {
                const snap = await loadAkteExportSnapshot(patientId, { loadClinical: canViewClinical });
                const interop = buildInteroperableAkteJson(snap, secForRust);
                let text: string;
                let prevFmt: ExportFormat;
                if (format === "json") {
                    text = `${JSON.stringify(interop, null, 2)}\n`;
                    prevFmt = "json";
                } else if (format === "xml") {
                    text = `${buildAkteExportXmlInterop(interop)}\n`;
                    prevFmt = "xml";
                } else {
                    text = `${buildAkteExportCsvFromInterop(interop)}\n`;
                    prevFmt = "csv";
                }
                const ext = extForFormat(format);
                const base = name.replace(/\.[^.]+$/, "");
                const finalName = name.toLowerCase().endsWith(`.${ext}`) ? name : `${base}.${ext}`;
                await finishExportWithSettings({
                    format: prevFmt,
                    title: "Patientenakte — Export",
                    hint:
                        format === "csv"
                            ? "CSV: Meta + flacher Datenbereich (Semikolon)."
                            : format === "xml"
                              ? "XML: EhrExtract-Hülle, eingebettetes FHIR-JSON."
                              : "JSON: documentManifest + FHIR + Domain.",
                    suggestedFilename: finalName,
                    mime:
                        format === "csv"
                            ? "text/csv;charset=utf-8"
                            : format === "xml"
                              ? "application/xml"
                              : "application/json",
                    textBody: text,
                    folderOverride: destFolder,
                });
            }
            onClose();
        } catch (e) {
            toast(`Export fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    const templateOptions = useMemo(() => {
        const o: { value: string; label: string }[] = [
            { value: "__default__", label: "Standard (System)" },
            ...builtins.map((b) => ({ value: `builtin:${b.id}`, label: `${b.name} (eingebaut)` })),
            ...userTpl.map((r) => ({ value: r.id, label: r.isDefault ? `${r.name} (Standard)` : r.name })),
        ];
        return o;
    }, [builtins, userTpl]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Export — Patientenakte"
            className="modal--akte-export modal--wide"
            footer={(
                <>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                        Abbrechen
                    </Button>
                    <Button type="button" onClick={() => void runExport()} loading={busy} disabled={busy || !patient}>
                        Exportieren
                    </Button>
                </>
            )}
        >
            <div className="akte-export-dialog-layout">
                <div className="akte-export-dialog-form-col">
                    <p className="text-body text-on-surface-variant" style={{ margin: 0, fontSize: 13 }}>
                        Bereiche, Format und Speicherort. PDF-Vorschau aktualisiert sich kurz nach Änderungen.
                    </p>
                    <Select
                        id="export-picker-akte-format"
                        label="Dateiformat"
                        value={format}
                        onChange={(e) => setFormat(e.target.value as AkteExportFileFormat)}
                        options={[
                            { value: "pdf", label: "PDF (druckfertig)" },
                            { value: "json", label: "JSON" },
                            { value: "xml", label: "XML" },
                            { value: "csv", label: "CSV (Semikolon)" },
                        ]}
                    />
                    <Select
                        id="export-picker-akte-template"
                        label="Dokumentvorlage (PDF-Layout)"
                        value={tplChoice}
                        onChange={(e) => setTplChoice(e.target.value)}
                        options={templateOptions}
                    />
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
                            id="export-picker-akte-filename"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            list="export-picker-akte-filename-suggestions"
                            className="input-edit"
                            autoComplete="off"
                        />
                        <datalist id="export-picker-akte-filename-suggestions">
                            {filenameSuggestions.map((s) => (
                                <option key={s} value={s} />
                            ))}
                        </datalist>
                    </div>
                    <fieldset style={{ border: "1px solid var(--border-1)", borderRadius: 8, padding: "12px 14px", margin: 0 }}>
                        <legend className="text-label" style={{ padding: "0 6px" }}>Inhalte</legend>
                        <div className="col" style={{ gap: 10 }}>
                            {AKTE_EXPORT_SECTION_META.map((row) => {
                                const disMed = row.needsMedical && !canViewClinical;
                                const disFin = row.needsFinanzen && !canReadFinanzen;
                                const disAudit = row.needsAuditRead && !canAuditRead;
                                const dis = disMed || disFin || disAudit;
                                return (
                                    <label
                                        key={row.key}
                                        className="row"
                                        style={{
                                            gap: 10,
                                            alignItems: "flex-start",
                                            cursor: dis ? "not-allowed" : "pointer",
                                            opacity: dis ? 0.5 : 1,
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={Boolean(sections[row.key]) && !dis}
                                            disabled={dis}
                                            onChange={() => {
                                                if (!dis) toggle(row.key);
                                            }}
                                        />
                                        <span className="text-body" style={{ fontSize: 13 }}>
                                            {row.label}
                                            {dis ? (
                                                <span className="text-caption text-on-surface-variant">
                                                    {" "}
                                                    — für Ihre Rolle nicht verfügbar
                                                </span>
                                            ) : null}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>
                </div>
                <div className="akte-export-dialog-preview-col">
                    <div className="text-label">Vorschau (PDF)</div>
                    <div className="akte-export-pdf-preview-box">
                        {format !== "pdf" ? (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>Vorschau nur für PDF.</p>
                        ) : previewBusy ? (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>PDF wird erzeugt …</p>
                        ) : previewUrl ? (
                            <iframe title="PDF-Vorschau" src={previewUrl} />
                        ) : (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>Bereiche wählen; Vorschau erscheint automatisch.</p>
                        )}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}

export type HtmlExportDocumentKind = Extract<DocumentKind, "attest" | "rezept" | "quittung">;

/** Entspricht den Optionen unter „Einstellungen › Export & Druck › Standardformat“. */
const CLINICAL_EXPORT_FORMAT_OPTS: { value: ExportFileFormat; label: string }[] = [
    { value: "pdf", label: "PDF" },
    { value: "csv", label: "CSV" },
    { value: "json", label: "JSON" },
    { value: "xml", label: "XML" },
];

function clinicalFilenameBase(raw: string, fallbackBasename: string): string {
    const t = raw.trim();
    if (!t) return fallbackBasename.replace(/\.(pdf|csv|json|xml)$/i, "");
    return t.replace(/\.(pdf|csv|json|xml)$/i, "");
}

function clinicalFilenameWithExtension(baseWithoutExt: string, fmt: ExportFileFormat): string {
    const ext = fmt === "pdf" ? "pdf" : fmt === "csv" ? "csv" : fmt === "json" ? "json" : "xml";
    const b = baseWithoutExt.trim() || "export";
    return `${b}.${ext}`;
}

function mimeClinical(fmt: ExportFileFormat): string {
    switch (fmt) {
        case "pdf":
            return "application/pdf";
        case "csv":
            return "text/csv;charset=utf-8";
        case "json":
            return "application/json";
        case "xml":
            return "application/xml";
        default:
            return "application/octet-stream";
    }
}

export type HtmlDocumentExportPickerProps = {
    open: boolean;
    onClose: () => void;
    templateKind: HtmlExportDocumentKind;
    exportPreviewTitle: string;
    /** Basis ohne Pflicht-Endung — Extension aus gewähltem Format (wie Export-Einstellungen). */
    suggestedBasename: string;
    bundle: ClinicalDocumentExportBundle;
    hint?: string;
};

/** UX wie „Einstellungen › Export & Druck“: Standardpfad, Standardformat pro Dokumentart, strukturierte Vorlage, PDF ohne Roh-HTML. */
export function HtmlDocumentExportPickerDialog(props: HtmlDocumentExportPickerProps) {
    return <HtmlDocumentExportPickerInner {...props} />;
}

function HtmlDocumentExportPickerInner({
    open,
    onClose,
    templateKind,
    exportPreviewTitle,
    suggestedBasename,
    bundle,
    hint,
}: HtmlDocumentExportPickerProps) {
    const toast = useToastStore((s) => s.add);
    const [fileName, setFileName] = useState("");
    const [busy, setBusy] = useState(false);
    const [pathCfg, setPathCfg] = useState<ExportPathConfigV1 | null>(null);
    const [formatsCfg, setFormatsCfg] = useState<ExportFormatsConfigV1 | null>(null);
    const [folderOnce, setFolderOnce] = useState<string | null>(null);
    const [tplChoice, setTplChoice] = useState<string>("__default__");
    const [userTpl, setUserTpl] = useState<DokumentTemplateDto[]>([]);
    const [format, setFormat] = useState<ExportFileFormat>("pdf");
    const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
    const [pdfPreviewBusy, setPdfPreviewBusy] = useState(false);
    const pdfPreviewUrlRef = useRef<string | null>(null);

    const builtins = BUILTIN_TEMPLATES_BY_KIND[templateKind];

    const resolvedTpl = useMemo((): { payload: DocumentTemplatePayloadV1; displayName: string } => {
        if (tplChoice.startsWith("builtin:")) {
            const id = tplChoice.slice("builtin:".length);
            const b = builtins.find((x) => x.id === id);
            if (b) return { payload: structuredClone(b.payload), displayName: b.name };
        }
        if (tplChoice === "__default__") {
            const b = builtins[0];
            if (b) return { payload: structuredClone(b.payload), displayName: b.name };
            return { payload: emptyDocumentTemplatePayloadV1(), displayName: "Standard" };
        }
        const row = userTpl.find((r) => r.id === tplChoice);
        if (row) {
            const payload = parseTemplatePayloadJson(row.payload) ?? emptyDocumentTemplatePayloadV1();
            return { payload, displayName: row.name };
        }
        const b = builtins[0];
        return {
            payload: b ? structuredClone(b.payload) : emptyDocumentTemplatePayloadV1(),
            displayName: b?.name ?? "Standard",
        };
    }, [tplChoice, builtins, userTpl]);

    useEffect(() => {
        if (!open) return;
        void (async () => {
            try {
                const [p, f] = await Promise.all([loadExportPathConfig(), loadExportFormatsConfig()]);
                setPathCfg(p);
                setFormatsCfg(f);
            } catch {
                setPathCfg({ mode: "documents", customPath: "" });
                setFormatsCfg({ defaultFormat: "pdf", perKind: {} });
            }
        })();
    }, [open]);

    useEffect(() => {
        if (!open || !formatsCfg) return;
        setFormat(defaultFormatForKind(formatsCfg, templateKind));
    }, [open, formatsCfg, templateKind]);

    useEffect(() => {
        if (!open) return;
        void (async () => {
            try {
                const rows = await listDokumentTemplatesForKind(templateKind);
                setUserTpl(rows);
                const def = rows.find((r) => r.isDefault);
                setTplChoice(def?.id ?? "__default__");
            } catch {
                setUserTpl([]);
            }
        })();
    }, [open, templateKind]);

    useEffect(() => {
        if (!open) return;
        setFileName(suggestedBasename);
        setFolderOnce(null);
    }, [open, suggestedBasename]);

    const revokePdfPreview = useCallback(() => {
        const u = pdfPreviewUrlRef.current;
        if (u?.startsWith("blob:")) {
            try {
                URL.revokeObjectURL(u);
            } catch {
                /* ignore */
            }
        }
        pdfPreviewUrlRef.current = null;
        setPdfPreviewUrl(null);
    }, []);

    useEffect(() => {
        if (!open) {
            revokePdfPreview();
            return;
        }
        if (format !== "pdf" || bundle.pdfBodyLines.length === 0) {
            revokePdfPreview();
            return;
        }
        const { payload, displayName } = resolvedTpl;
        const t = window.setTimeout(() => {
            void (async () => {
                setPdfPreviewBusy(true);
                try {
                    const b64 = await previewDocumentPdf(templateKind, displayName, payload, bundle.pdfBodyLines);
                    const bin = atob(b64);
                    const bytes = new Uint8Array(bin.length);
                    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                    revokePdfPreview();
                    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
                    pdfPreviewUrlRef.current = url;
                    setPdfPreviewUrl(url);
                } catch (e) {
                    toast(`PDF-Vorschau: ${e instanceof Error ? e.message : String(e)}`, "error");
                    revokePdfPreview();
                } finally {
                    setPdfPreviewBusy(false);
                }
            })();
        }, 420);
        return () => {
            window.clearTimeout(t);
        };
    }, [open, format, templateKind, bundle.pdfBodyLines, resolvedTpl, toast, revokePdfPreview]);

    useEffect(() => {
        if (!open) revokePdfPreview();
    }, [open, revokePdfPreview]);

    const resolvedPathLabel = useMemo(() => {
        if (folderOnce?.trim()) return folderOnce.trim();
        if (pathCfg) return describeResolvedExportPath(pathCfg);
        return "…";
    }, [folderOnce, pathCfg]);

    const effectiveFormatHint = useMemo(() => {
        if (!formatsCfg) return "";
        const eff = defaultFormatForKind(formatsCfg, templateKind);
        return `Standard aus Einstellungen für „${DOCUMENT_KIND_LABEL[templateKind]}“: ${eff.toUpperCase()}`;
    }, [formatsCfg, templateKind]);

    const templateOptions = useMemo(() => {
        const o: { value: string; label: string }[] = [
            { value: "__default__", label: "Standard (System)" },
            ...builtins.map((b) => ({ value: `builtin:${b.id}`, label: `${b.name} (eingebaut)` })),
            ...userTpl.map((r) => ({ value: r.id, label: r.isDefault ? `${r.name} (Standard)` : r.name })),
        ];
        return o;
    }, [builtins, userTpl]);

    const csvPreviewRows = useMemo(() => parseDelimitedGrid(stripBom(bundle.csvText)).rows, [bundle.csvText]);

    const previewText = format === "json" ? bundle.jsonText : format === "xml" ? bundle.xmlText : "";

    const runExport = async () => {
        const hasPayload =
            bundle.pdfBodyLines.length > 0 ||
            bundle.csvText.trim().length > 0 ||
            bundle.jsonText.trim().length > 0 ||
            bundle.xmlText.trim().length > 0;
        if (!hasPayload) {
            toast("Kein Dokumentinhalt.", "error");
            return;
        }
        const baseNoExt = clinicalFilenameBase(fileName, suggestedBasename);
        const finalName = clinicalFilenameWithExtension(baseNoExt, format);
        const destFolder = folderOnce?.trim() || null;
        const { payload, displayName } = resolvedTpl;

        setBusy(true);
        try {
            if (format === "pdf") {
                const b64 = await previewDocumentPdf(templateKind, displayName, payload, bundle.pdfBodyLines);
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                await finishExportWithSettings({
                    format: "pdf",
                    title: exportPreviewTitle,
                    hint:
                        hint ?? `PDF gemäß Vorlage „${displayName}“. ${effectiveFormatHint}`,
                    suggestedFilename: finalName,
                    mime: mimeClinical("pdf"),
                    binaryBody: bytes,
                    folderOverride: destFolder,
                });
            } else if (format === "csv") {
                await finishExportWithSettings({
                    format: "csv",
                    title: exportPreviewTitle,
                    hint: hint ?? `CSV (Semikolon). ${effectiveFormatHint}`,
                    suggestedFilename: finalName,
                    mime: mimeClinical("csv"),
                    textBody: bundle.csvText,
                    folderOverride: destFolder,
                });
            } else if (format === "json") {
                await finishExportWithSettings({
                    format: "json",
                    title: exportPreviewTitle,
                    hint: hint ?? `JSON. ${effectiveFormatHint}`,
                    suggestedFilename: finalName,
                    mime: mimeClinical("json"),
                    textBody: bundle.jsonText,
                    folderOverride: destFolder,
                });
            } else {
                await finishExportWithSettings({
                    format: "xml",
                    title: exportPreviewTitle,
                    hint: hint ?? `XML. ${effectiveFormatHint}`,
                    suggestedFilename: finalName,
                    mime: mimeClinical("xml"),
                    textBody: bundle.xmlText,
                    folderOverride: destFolder,
                });
            }
            onClose();
        } catch (e) {
            toast(`Export fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    const dialogTitle = `Export — ${DOCUMENT_KIND_LABEL[templateKind]}`;
    const hasContent =
        bundle.pdfBodyLines.length > 0 ||
        bundle.csvText.trim().length > 0 ||
        bundle.jsonText.trim().length > 0 ||
        bundle.xmlText.trim().length > 0;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={dialogTitle}
            className="modal--akte-export modal--wide"
            footer={(
                <>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                        Abbrechen
                    </Button>
                    <Button type="button" onClick={() => void runExport()} loading={busy} disabled={busy || !hasContent}>
                        Exportieren
                    </Button>
                </>
            )}
        >
            <div className="akte-export-dialog-layout">
                <div className="akte-export-dialog-form-col">
                    <p className="text-body text-on-surface-variant" style={{ margin: 0, fontSize: 13 }}>
                        Entspricht <strong>Einstellungen › Export &amp; Druck</strong>: Standardpfad, Format pro Dokumentart und
                        strukturierte Dokumentvorlage (kein Freitext-HTML). Änderungen der Standards erfolgen dort.
                    </p>
                    <Select
                        id="export-picker-clinical-format"
                        label="Dateiformat"
                        value={format}
                        onChange={(e) => setFormat(e.target.value as ExportFileFormat)}
                        options={CLINICAL_EXPORT_FORMAT_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                    />
                    {effectiveFormatHint ? (
                        <p className="text-caption text-on-surface-variant" style={{ margin: "-4px 0 0", fontSize: 12 }}>
                            {effectiveFormatHint}
                        </p>
                    ) : null}
                    <Select
                        id="export-picker-clinical-template"
                        label="Dokumentvorlage"
                        value={tplChoice}
                        onChange={(e) => setTplChoice(e.target.value)}
                        options={templateOptions}
                    />
                    <div>
                        <div className="text-label" style={{ marginBottom: 8 }}>Standardpfad für Exporte</div>
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
                        <div className="text-label" style={{ marginBottom: 8 }}>Dateiname (ohne oder mit Endung)</div>
                        <Input
                            id="export-picker-clinical-filename"
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
                        {!hasContent ? (
                            <p className="card-pad card-sub" style={{ margin: 0 }}>Kein Inhalt.</p>
                        ) : format === "pdf" ? (
                            pdfPreviewBusy ? (
                                <p className="card-pad card-sub" style={{ margin: 0 }}>PDF wird erzeugt …</p>
                            ) : pdfPreviewUrl ? (
                                <iframe title="PDF-Vorschau" src={pdfPreviewUrl} />
                            ) : (
                                <p className="card-pad card-sub" style={{ margin: 0 }}>PDF wird vorbereitet …</p>
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
                            <p className="card-pad card-sub" style={{ margin: 0 }}>Keine CSV-Zeilen.</p>
                        ) : (
                            <pre
                                className="card card-pad export-preview-pre"
                                style={{ margin: 0, maxHeight: 420, overflow: "auto", fontSize: 12 }}
                            >
                                {previewText}
                            </pre>
                        )}
                    </div>
                </div>
            </div>
        </Dialog>
    );
}
