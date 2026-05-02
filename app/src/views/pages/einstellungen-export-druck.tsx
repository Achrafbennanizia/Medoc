import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/views/components/ui/button";
import { Select } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { DocumentTemplateEditor } from "@/views/components/document-template-editor";
import {
    BUILTIN_TEMPLATES_BY_KIND,
    DOCUMENT_KIND_LABEL,
    type BuiltinTemplateMeta,
    type DocumentKind,
    type DocumentTemplatePayloadV1,
    emptyDocumentTemplatePayloadV1,
    parseTemplatePayloadJson,
} from "@/lib/document-template-schema";
import {
    describeResolvedExportPath,
    loadExportFormatsConfig,
    loadExportPathConfig,
    saveExportFormatsConfig,
    saveExportPathConfig,
    type ExportFileFormat,
    type ExportFormatsConfigV1,
    type ExportPathConfigV1,
} from "@/lib/export-settings";
import {
    createDokumentTemplate,
    deleteDokumentTemplate,
    listDokumentTemplatesForKind,
    pickExportDirectory,
    previewTemplatePdf,
    updateDokumentTemplate,
    type DokumentTemplateDto,
} from "@/controllers/document-template.controller";
import { isTauriApp } from "@/lib/save-download";
import { openExportPreview } from "@/models/store/export-preview-store";

const TEMPLATE_KINDS: DocumentKind[] = ["quittung", "rezept", "attest", "rechnung", "tagesbericht"];

const FORMAT_OPTS: { value: ExportFileFormat; label: string }[] = [
    { value: "pdf", label: "PDF" },
    { value: "csv", label: "CSV" },
    { value: "json", label: "JSON" },
    { value: "xml", label: "XML" },
];

const ALL_KINDS_FOR_FORMAT = Object.keys(DOCUMENT_KIND_LABEL) as DocumentKind[];

function base64PdfToBytes(b64: string): Uint8Array {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

export function EinstellungenExportDruckSection() {
    const toast = useToastStore((s) => s.add);
    const [pathCfg, setPathCfg] = useState<ExportPathConfigV1>({ mode: "documents", customPath: "" });
    const [formats, setFormats] = useState<ExportFormatsConfigV1>({
        defaultFormat: "pdf",
        perKind: {},
    });
    const [hydrated, setHydrated] = useState(false);

    const [tplByKind, setTplByKind] = useState<Partial<Record<DocumentKind, DokumentTemplateDto[]>>>({});
    const [openAcc, setOpenAcc] = useState<DocumentKind | null>("quittung");

    const [editorOpen, setEditorOpen] = useState(false);
    const [editorTitle, setEditorTitle] = useState("");
    const [editorInitial, setEditorInitial] = useState<DocumentTemplatePayloadV1>(() => emptyDocumentTemplatePayloadV1());
    const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
    const [editorTargetId, setEditorTargetId] = useState<string | null>(null);
    const [editorKind, setEditorKind] = useState<DocumentKind>("quittung");
    const [editorNewName, setEditorNewName] = useState("");

    useEffect(() => {
        let c = false;
        void (async () => {
            try {
                const [p, f] = await Promise.all([loadExportPathConfig(), loadExportFormatsConfig()]);
                if (c) return;
                setPathCfg(p);
                setFormats(f);
                setHydrated(true);
            } catch (e) {
                if (!c) toast(`Export-Einstellungen: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        })();
        return () => {
            c = true;
        };
    }, [toast]);

    const reloadTemplates = useCallback(async (kind: DocumentKind) => {
        try {
            const rows = await listDokumentTemplatesForKind(kind);
            setTplByKind((prev) => ({ ...prev, [kind]: rows }));
        } catch (e) {
            toast(`Vorlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    }, [toast]);

    useEffect(() => {
        if (!openAcc) return;
        void reloadTemplates(openAcc);
    }, [openAcc, reloadTemplates]);

    const persistPath = async (next: ExportPathConfigV1) => {
        try {
            await saveExportPathConfig(next);
            setPathCfg(next);
            toast("Export-Pfad gespeichert", "success");
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const persistFormats = async (next: ExportFormatsConfigV1) => {
        try {
            await saveExportFormatsConfig(next);
            setFormats(next);
            toast("Standardformate gespeichert", "success");
        } catch (e) {
            toast(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const pathDescription = useMemo(() => describeResolvedExportPath(pathCfg), [pathCfg]);

    const openBuiltinPreview = async (kind: DocumentKind, b: BuiltinTemplateMeta) => {
        try {
            const b64 = await previewTemplatePdf(kind, b.name, b.payload);
            openExportPreview({
                format: "pdf",
                title: `Vorlage — ${DOCUMENT_KIND_LABEL[kind]}`,
                hint: b.description,
                suggestedFilename: `vorschau-${kind}-${b.id}.pdf`,
                binaryBody: base64PdfToBytes(b64),
            });
        } catch (e) {
            toast(`Vorschau: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const openUserPreview = async (kind: DocumentKind, row: DokumentTemplateDto) => {
        const parsed = parseTemplatePayloadJson(row.payload);
        if (!parsed) {
            toast("Vorlagen-Payload ungültig", "error");
            return;
        }
        try {
            const b64 = await previewTemplatePdf(kind, row.name, parsed);
            openExportPreview({
                format: "pdf",
                title: `Vorlage — ${row.name}`,
                hint: DOCUMENT_KIND_LABEL[kind],
                suggestedFilename: `vorschau-${kind}-${row.id}.pdf`,
                binaryBody: base64PdfToBytes(b64),
            });
        } catch (e) {
            toast(`Vorschau: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const startCreate = (kind: DocumentKind) => {
        setEditorKind(kind);
        setEditorMode("create");
        setEditorTargetId(null);
        setEditorInitial(emptyDocumentTemplatePayloadV1());
        setEditorNewName("");
        setEditorTitle("Neue Dokumentvorlage");
        setEditorOpen(true);
    };

    const startEditUser = (kind: DocumentKind, row: DokumentTemplateDto) => {
        const parsed = parseTemplatePayloadJson(row.payload) ?? emptyDocumentTemplatePayloadV1();
        setEditorKind(kind);
        setEditorMode("edit");
        setEditorTargetId(row.id);
        setEditorInitial(parsed);
        setEditorNewName(row.name);
        setEditorTitle(`Vorlage bearbeiten — ${row.name}`);
        setEditorOpen(true);
    };

    const startFromBuiltin = (kind: DocumentKind, b: BuiltinTemplateMeta) => {
        setEditorKind(kind);
        setEditorMode("create");
        setEditorTargetId(null);
        setEditorInitial(structuredClone(b.payload));
        setEditorNewName(`${b.name} (Kopie)`);
        setEditorTitle(`Vorlage aus „${b.name}“`);
        setEditorOpen(true);
    };

    const handleEditorSave = async (payload: DocumentTemplatePayloadV1): Promise<boolean> => {
        const name = editorNewName.trim();
        if (!name) {
            toast("Name erforderlich", "info");
            return false;
        }
        try {
            if (editorMode === "create") {
                await createDokumentTemplate({ kind: editorKind, name, payload, isDefault: false });
                toast("Vorlage angelegt", "success");
            } else if (editorTargetId) {
                await updateDokumentTemplate({ id: editorTargetId, name, payload });
                toast("Vorlage gespeichert", "success");
            }
            await reloadTemplates(editorKind);
            return true;
        } catch (e) {
            toast(`Vorlage: ${e instanceof Error ? e.message : String(e)}`, "error");
            return false;
        }
    };

    const copyBuiltin = async (kind: DocumentKind, b: BuiltinTemplateMeta) => {
        const name = `${b.name} (Kopie)`;
        try {
            await createDokumentTemplate({
                kind,
                name,
                payload: structuredClone(b.payload),
                isDefault: false,
            });
            toast("Vorlage kopiert", "success");
            await reloadTemplates(kind);
        } catch (e) {
            toast(`Kopieren: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const copyUser = async (kind: DocumentKind, row: DokumentTemplateDto) => {
        const parsed = parseTemplatePayloadJson(row.payload) ?? emptyDocumentTemplatePayloadV1();
        try {
            await createDokumentTemplate({
                kind,
                name: `${row.name} (Kopie)`,
                payload: parsed,
                isDefault: false,
            });
            toast("Vorlage kopiert", "success");
            await reloadTemplates(kind);
        } catch (e) {
            toast(`Kopieren: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const removeUser = async (kind: DocumentKind, row: DokumentTemplateDto) => {
        const ok = typeof window !== "undefined" ? window.confirm(`Vorlage „${row.name}“ löschen?`) : false;
        if (!ok) return;
        try {
            await deleteDokumentTemplate(row.id);
            toast("Vorlage gelöscht", "success");
            await reloadTemplates(kind);
        } catch (e) {
            toast(`Löschen: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const setDefaultUser = async (kind: DocumentKind, row: DokumentTemplateDto) => {
        const parsed = parseTemplatePayloadJson(row.payload) ?? emptyDocumentTemplatePayloadV1();
        try {
            await updateDokumentTemplate({ id: row.id, name: row.name, payload: parsed, isDefault: true });
            toast("Standardvorlage gesetzt", "success");
            await reloadTemplates(kind);
        } catch (e) {
            toast(`Standard: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    return (
        <section>
            <div className="card-head">
                <div>
                    <div className="card-title">Export &amp; Druck</div>
                    <div className="card-sub">
                        Speicherorte, Dateiformate und druckbare Dokumentvorlagen (ohne Roh-HTML, strukturiert)
                    </div>
                </div>
            </div>

            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, margin: 0, padding: "14px 16px" }}>
                    <legend className="text-label">Standardpfad für Exporte</legend>
                    <div className="col" style={{ gap: 10 }}>
                        <label className="row" style={{ gap: 10 }}>
                            <input
                                type="radio"
                                name="export-path-mode"
                                checked={pathCfg.mode === "documents"}
                                disabled={!hydrated}
                                onChange={() => void persistPath({ mode: "documents", customPath: pathCfg.customPath ?? "" })}
                            />
                            Standard (Dokumente-Ordner)
                        </label>
                        <label className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                                type="radio"
                                name="export-path-mode"
                                checked={pathCfg.mode === "custom"}
                                disabled={!hydrated || !isTauriApp()}
                                onChange={() => void persistPath({ mode: "custom", customPath: pathCfg.customPath ?? "" })}
                            />
                            Eigener Pfad
                            <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={!isTauriApp() || pathCfg.mode !== "custom"}
                                onClick={async () => {
                                    const picked = await pickExportDirectory();
                                    if (picked) await persistPath({ mode: "custom", customPath: picked });
                                }}
                            >
                                Ordner wählen …
                            </Button>
                        </label>
                        {!isTauriApp() ? (
                            <p className="card-sub" style={{ margin: 0 }}>
                                Eigener Pfad nur in der Desktop-App (Tauri).
                            </p>
                        ) : null}
                        <p className="text-body" style={{ margin: 0, fontSize: 13 }}>
                            <b>Aufgelöst:</b> {pathDescription}
                        </p>
                    </div>
                </fieldset>

                <fieldset style={{ border: "1px solid var(--line)", borderRadius: 10, margin: 0, padding: "14px 16px" }}>
                    <legend className="text-label">Standardformat</legend>
                    <div className="col" style={{ gap: 12 }}>
                        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                            {FORMAT_OPTS.map((o) => (
                                <label key={o.value} className="row" style={{ gap: 8 }}>
                                    <input
                                        type="radio"
                                        name="export-default-format"
                                        checked={formats.defaultFormat === o.value}
                                        disabled={!hydrated}
                                        onChange={() =>
                                            void persistFormats({ ...formats, defaultFormat: o.value })}
                                    />
                                    {o.label}
                                </label>
                            ))}
                        </div>
                        <div className="text-label" style={{ marginTop: 8 }}>Abweichung pro Dokumentart</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {ALL_KINDS_FOR_FORMAT.map((k) => {
                                const locked = k === "rechnung";
                                return (
                                    <Select
                                        key={k}
                                        label={DOCUMENT_KIND_LABEL[k]}
                                        value={locked ? "pdf" : formats.perKind[k] ?? "__default__"}
                                        disabled={!hydrated || locked}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            const per = { ...formats.perKind };
                                            if (v === "__default__") delete per[k];
                                            else per[k] = v as ExportFileFormat;
                                            void persistFormats({ ...formats, perKind: per });
                                        }}
                                        options={
                                            locked
                                                ? [{ value: "pdf", label: "PDF (nur PDF)" }]
                                                : [
                                                      {
                                                          value: "__default__",
                                                          label: `Standard (${formats.defaultFormat.toUpperCase()})`,
                                                      },
                                                      ...FORMAT_OPTS,
                                                  ]
                                        }
                                    />
                                );
                            })}
                        </div>
                        {hydrated ? (
                            <p className="card-sub" style={{ margin: 0 }}>
                                Effektive Formate (Hinweis): Rechnung ist immer PDF. Akte standardmäßig PDF, Audit-Listen
                                CSV — jeweils überschreibbar, soweit das Zielformat vom Export unterstützt wird.
                            </p>
                        ) : null}
                    </div>
                </fieldset>

                <div>
                    <div className="text-title" style={{ margin: "0 0 10px", fontSize: 16 }}>{"Dokument-Vorlagen"}</div>
                    <p className="card-sub" style={{ margin: "0 0 12px" }}>
                        Drei eingebaute Layouts pro Art (nicht löschbar). Eigene Vorlagen liegen in der Datenbank;
                        Bearbeiten erfolgt über die strukturierten Felder (kein Freitext-HTML).
                    </p>
                    <div className="col" style={{ gap: 8 }}>
                        {TEMPLATE_KINDS.map((kind) => {
                            const builtins = BUILTIN_TEMPLATES_BY_KIND[kind];
                            const userRows = tplByKind[kind] ?? [];
                            const expanded = openAcc === kind;
                            return (
                                <div
                                    key={kind}
                                    style={{
                                        border: "1px solid var(--line)",
                                        borderRadius: 10,
                                        overflow: "hidden",
                                        background: "var(--surface)",
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="row"
                                        style={{
                                            width: "100%",
                                            justifyContent: "space-between",
                                            padding: "12px 14px",
                                            border: "none",
                                            background: expanded ? "var(--surface-2)" : "transparent",
                                            cursor: "pointer",
                                            font: "inherit",
                                            textAlign: "left",
                                        }}
                                        onClick={() => setOpenAcc((c) => (c === kind ? null : kind))}
                                    >
                                        <span className="text-title" style={{ fontSize: 15 }}>
                                            {DOCUMENT_KIND_LABEL[kind]}
                                        </span>
                                        <span className="text-caption" style={{ color: "var(--fg-3)" }}>
                                            {expanded ? "▾" : "▸"}
                                        </span>
                                    </button>
                                    {expanded ? (
                                        <div style={{ padding: "0 14px 14px" }}>
                                            <div className="row" style={{ justifyContent: "flex-end", marginBottom: 10 }}>
                                                <Button type="button" size="sm" onClick={() => startCreate(kind)}>
                                                    + Vorlage
                                                </Button>
                                            </div>
                                            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                                                {builtins.map((b) => (
                                                    <li
                                                        key={`b-${b.id}`}
                                                        className="row"
                                                        style={{
                                                            flexWrap: "wrap",
                                                            gap: 8,
                                                            alignItems: "center",
                                                            padding: "8px 10px",
                                                            borderRadius: 8,
                                                            background: "var(--surface-2)",
                                                        }}
                                                    >
                                                        <span style={{ flex: "1 1 140px" }}>
                                                            <b>{b.name}</b>
                                                            <span className="card-sub" style={{ marginLeft: 8 }}>Eingebaut</span>
                                                        </span>
                                                        <span className="pill" style={{ fontSize: 11 }}>Standard-Layout</span>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => void openBuiltinPreview(kind, b)}>
                                                            Vorschau
                                                        </Button>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => startFromBuiltin(kind, b)}>
                                                            Bearbeiten
                                                        </Button>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => void copyBuiltin(kind, b)}>
                                                            Kopieren
                                                        </Button>
                                                    </li>
                                                ))}
                                                {userRows.map((row) => (
                                                    <li
                                                        key={row.id}
                                                        className="row"
                                                        style={{
                                                            flexWrap: "wrap",
                                                            gap: 8,
                                                            alignItems: "center",
                                                            padding: "8px 10px",
                                                            borderRadius: 8,
                                                            border: "1px solid var(--line)",
                                                        }}
                                                    >
                                                        <span style={{ flex: "1 1 140px" }}>
                                                            <b>{row.name}</b>
                                                            {row.isDefault ? (
                                                                <span className="pill blue" style={{ marginLeft: 8, fontSize: 11 }}>Standard</span>
                                                            ) : (
                                                                <Button type="button" size="sm" variant="ghost" onClick={() => void setDefaultUser(kind, row)}>
                                                                    Als Standard
                                                                </Button>
                                                            )}
                                                        </span>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => void openUserPreview(kind, row)}>
                                                            Vorschau
                                                        </Button>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => startEditUser(kind, row)}>
                                                            Bearbeiten
                                                        </Button>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => void copyUser(kind, row)}>
                                                            Kopieren
                                                        </Button>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => void removeUser(kind, row)}>
                                                            Löschen
                                                        </Button>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <DocumentTemplateEditor
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                initial={editorInitial}
                title={editorTitle}
                onSave={(pl) => handleEditorSave(pl)}
                showNameField={editorMode === "create" || editorMode === "edit"}
                templateName={editorNewName}
                onTemplateNameChange={setEditorNewName}
            />
        </section>
    );
}
