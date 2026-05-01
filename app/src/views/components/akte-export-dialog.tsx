import { useEffect, useMemo, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import type { Patient } from "@/models/types";
import { openExportPreview } from "@/models/store/export-preview-store";
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

export type AkteExportDialogProps = {
    open: boolean;
    onClose: () => void;
    patientId: string;
    patient: Patient | null;
    canViewClinical: boolean;
    canReadFinanzen: boolean;
};

function extForFormat(f: AkteExportFileFormat): string {
    return f;
}

export function AkteExportDialog({
    open,
    onClose,
    patientId,
    patient,
    canViewClinical,
    canReadFinanzen,
}: AkteExportDialogProps) {
    const toast = useToastStore((s) => s.add);
    const [sections, setSections] = useState<AkteExportSectionsState>(() => defaultAkteExportSections());
    const [format, setFormat] = useState<AkteExportFileFormat>("pdf");
    const [fileName, setFileName] = useState("");
    const [busy, setBusy] = useState(false);

    const filenameSuggestions = useMemo(() => {
        if (!patient) return [] as string[];
        return suggestAkteExportFilenames(patient, extForFormat(format));
    }, [patient, format]);

    useEffect(() => {
        if (!open || !patient) return;
        const d = defaultAkteExportSections();
        for (const row of AKTE_EXPORT_SECTION_META) {
            if (row.needsMedical && !canViewClinical) d[row.key] = false;
            if (row.needsFinanzen && !canReadFinanzen) d[row.key] = false;
        }
        setSections(d);
        setFormat("pdf");
        setFileName(suggestAkteExportFilenames(patient, "pdf")[0]);
    }, [open, patient, canViewClinical, canReadFinanzen]);

    useEffect(() => {
        if (!patient || !open) return;
        setFileName(suggestAkteExportFilenames(patient, extForFormat(format))[0]);
    }, [format, patient, open]);

    const anySelected = Object.values(sections).some(Boolean);

    const toggle = (key: keyof AkteExportSectionsState) => {
        setSections((p) => ({ ...p, [key]: !p[key] }));
    };

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
        }

        const name = fileName.trim() || suggestAkteExportFilenames(patient, extForFormat(format))[0];

        setBusy(true);
        try {
            if (format === "pdf") {
                const b64 = await exportAktePdf(patientId, secForRust);
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                openExportPreview({
                    format: "pdf",
                    title: "Patientenakte — Export",
                    hint: "PDF gemäß gewählter Bereiche. Anlagen nur als Metadaten.",
                    suggestedFilename: name.endsWith(".pdf") ? name : `${name}.pdf`,
                    binaryBody: bytes,
                });
            } else {
                const snap = await loadAkteExportSnapshot(patientId, { loadClinical: canViewClinical });
                const interop = buildInteroperableAkteJson(snap, secForRust);
                let text: string;
                if (format === "json") {
                    text = `${JSON.stringify(interop, null, 2)}\n`;
                } else if (format === "xml") {
                    text = `${buildAkteExportXmlInterop(interop)}\n`;
                } else {
                    text = `${buildAkteExportCsvFromInterop(interop)}\n`;
                }
                const ext = extForFormat(format);
                const base = name.replace(/\.[^.]+$/, "");
                const finalName = name.toLowerCase().endsWith(`.${ext}`) ? name : `${base}.${ext}`;
                openExportPreview({
                    format: format === "csv" ? "csv" : format === "xml" ? "xml" : "json",
                    title: "Patientenakte — Export",
                    hint:
                        format === "csv"
                            ? "CSV: Meta (Normhinweise) + flacher Datenbereich (Semikolon). Orientierung: ISO 13606-Extract-Idee, FHIR, DSGVO Art. 20."
                            : format === "xml"
                              ? "XML: EhrExtract-Hülle, eingebettetes FHIR-JSON, Domain-Daten. Kein zertifiziertes EN13606."
                              : "JSON: documentManifest + FHIR R4 Bundle (collection) + Composition + medocDomainPayload.",
                    suggestedFilename: finalName,
                    textBody: text,
                });
            }
            onClose();
        } catch (e) {
            toast(`Export fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title="Akte exportieren"
            className="modal--akte-export"
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                        Abbrechen
                    </Button>
                    <Button type="button" onClick={() => void runExport()} loading={busy} disabled={busy || !patient}>
                        Export starten
                    </Button>
                </>
            }
        >
            <div className="col" style={{ gap: 16 }}>
                <p className="text-body text-on-surface-variant" style={{ margin: 0, fontSize: 13 }}>
                    Wählen Sie Bereiche und Dateiformat. Vorschau, Drucken und Speichern folgen im nächsten Schritt.
                </p>
                <Select
                    id="akte-export-format"
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
                <div>
                    <div className="text-label" style={{ marginBottom: 8 }}>
                        Dateiname
                    </div>
                    <Input
                        id="akte-export-filename"
                        value={fileName}
                        onChange={(e) => setFileName(e.target.value)}
                        list="akte-export-filename-suggestions"
                        className="input-edit"
                        autoComplete="off"
                    />
                    <datalist id="akte-export-filename-suggestions">
                        {filenameSuggestions.map((s) => (
                            <option key={s} value={s} />
                        ))}
                    </datalist>
                    <p className="text-caption text-on-surface-variant" style={{ margin: "6px 0 0" }}>
                        Vorschläge: zeitgestempelt eindeutig, nach Name, oder mit Patienten-ID.
                    </p>
                </div>
                <fieldset style={{ border: "1px solid var(--border-1)", borderRadius: 8, padding: "12px 14px", margin: 0 }}>
                    <legend className="text-label" style={{ padding: "0 6px" }}>
                        Inhalte
                    </legend>
                    <div className="col" style={{ gap: 10 }}>
                        {AKTE_EXPORT_SECTION_META.map((row) => {
                            const dis =
                                (row.needsMedical && !canViewClinical) || (row.needsFinanzen && !canReadFinanzen);
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
        </Dialog>
    );
}
