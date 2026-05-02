import { useEffect, useRef, useState, type DragEvent } from "react";
import { CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";
import { useDismissibleLayer } from "./ui/use-dismissible-layer";
import { BoltIcon, MoreIcon, PlusIcon, ShieldCheckIcon, UploadCircleIcon } from "@/lib/icons";
import type { AkteAnlage } from "@/lib/akte-anlagen";
import {
    AKTE_ANLAGE_DOCUMENT_KIND_DEFAULT,
    AKTE_ANLAGE_DOCUMENT_KINDS,
    anlageBadgeExt,
    formatAnlageBytes,
    isAnlageImagePreview,
    labelForAkteDocumentKind,
    normalizeAkteDocumentKind,
    anlageCameraInputAccept,
    anlageInputAccept,
} from "@/lib/akte-anlagen";

const PREVIEW_TONE = [
    { grad: "linear-gradient(165deg, #e8f4fc 0%, #d4e8f8 55%, #c5dff5 100%)", doc: "#1a73e8" },
    { grad: "linear-gradient(165deg, #e8faf0 0%, #d4f3e3 55%, #c5ebd8 100%)", doc: "#0d9f5f" },
    { grad: "linear-gradient(165deg, #fff4e8 0%, #ffe8d4 55%, #ffdfc5 100%)", doc: "#c45c00" },
    { grad: "linear-gradient(165deg, #f4ecfc 0%, #e8dcf8 55%, #dcc9f2 100%)", doc: "#7c3aed" },
];

function AnlageDocGlyph({ color }: { color: string }) {
    return (
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M7 3h7l5 5v13H7V3z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M14 3v5h5" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M9 13h6M9 17h4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

function AnlageCardMenu({
    validated,
    canValidate,
    onValidate,
    onRevokeValidate,
    onOpenExternal,
    onDuplicate,
    onRenameTitle,
    onChangeKind,
    onRemove,
}: {
    validated: boolean;
    canValidate: boolean;
    onValidate: () => void;
    onRevokeValidate: () => void;
    onOpenExternal?: () => void;
    onDuplicate?: () => void;
    onRenameTitle?: () => void;
    onChangeKind?: () => void;
    onRemove?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    useDismissibleLayer({ open, rootRef, onDismiss: () => setOpen(false) });

    return (
        <div ref={rootRef} style={{ position: "relative" }}>
            <button
                type="button"
                className="anlage-card__more"
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label="Aktionen"
                onClick={() => setOpen((o) => !o)}
            >
                <MoreIcon size={18} />
            </button>
            {open ? (
                <div className="anlage-card__menu" role="menu">
                    {onOpenExternal ? (
                        <button type="button" role="menuitem" className="anlage-card__menu-item" onClick={() => { onOpenExternal(); setOpen(false); }}>
                            Extern öffnen…
                        </button>
                    ) : null}
                    {onDuplicate ? (
                        <button type="button" role="menuitem" className="anlage-card__menu-item" onClick={() => { onDuplicate(); setOpen(false); }}>
                            Kopie anlegen
                        </button>
                    ) : null}
                    {onRenameTitle ? (
                        <button type="button" role="menuitem" className="anlage-card__menu-item" onClick={() => { onRenameTitle(); setOpen(false); }}>
                            Bezeichnung ändern…
                        </button>
                    ) : null}
                    {onChangeKind ? (
                        <button type="button" role="menuitem" className="anlage-card__menu-item" onClick={() => { onChangeKind(); setOpen(false); }}>
                            Dokumenttyp ändern…
                        </button>
                    ) : null}
                    {canValidate ? (
                        validated ? (
                            <button type="button" role="menuitem" className="anlage-card__menu-item" onClick={() => { onRevokeValidate(); setOpen(false); }}>
                                Prüfung zurücksetzen
                            </button>
                        ) : (
                            <button type="button" role="menuitem" className="anlage-card__menu-item" onClick={() => { onValidate(); setOpen(false); }}>
                                <ShieldCheckIcon size={14} /> Validieren
                            </button>
                        )
                    ) : null}
                    {onRemove ? (
                        <button
                            type="button"
                            role="menuitem"
                            className="anlage-card__menu-item anlage-card__menu-item--danger"
                            onClick={() => {
                                onRemove();
                                setOpen(false);
                            }}
                        >
                            Entfernen
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export type AkteAnlagenPanelProps = {
    title?: string;
    subtitle: string;
    anlagen: AkteAnlage[];
    fileInputId: string;
    cameraInputId: string;
    /** Hochladen, Umbenennen, Löschen, Duplizieren (z. B. `patient.write_medical`) */
    canManageAnlagen: boolean;
    onPickFile: (file: File) => void;
    /** Umbenennung erfolgt über Menü „Bezeichnung ändern …“. */
    onRename: (idx: number, name: string) => void;
    onSetDocumentKind?: (idx: number, kind: string) => void;
    onRequestRemove: (idx: number, name: string) => void;
    onOpenExternal?: (idx: number) => void;
    onDuplicate?: (idx: number) => void;
    canValidate: boolean;
    isValidated: (anlageId: string) => boolean;
    onRequestValidate: (anlageId: string, label: string) => void;
    onRevokeValidation: (anlageId: string, shortLabel: string) => void;
    formatAddedAt: (iso: string) => string;
    onScannerClick: () => void;
};

export function AkteAnlagenPanel({
    title = "Anlagen",
    subtitle,
    anlagen,
    fileInputId,
    cameraInputId,
    canManageAnlagen,
    onPickFile,
    onRename,
    onSetDocumentKind,
    onRequestRemove,
    onOpenExternal,
    onDuplicate,
    canValidate,
    isValidated,
    onRequestValidate,
    onRevokeValidation,
    formatAddedAt,
    onScannerClick,
}: AkteAnlagenPanelProps) {
    const [dragOver, setDragOver] = useState(false);
    const [renameIdx, setRenameIdx] = useState<number | null>(null);
    const [renameDraft, setRenameDraft] = useState("");
    const [kindIdx, setKindIdx] = useState<number | null>(null);
    const [kindDraft, setKindDraft] = useState(AKTE_ANLAGE_DOCUMENT_KIND_DEFAULT);

    useEffect(() => {
        if (renameIdx === null) return;
        const row = anlagen[renameIdx];
        if (row) setRenameDraft(row.name);
    }, [renameIdx, anlagen]);

    useEffect(() => {
        if (kindIdx === null) return;
        const row = anlagen[kindIdx];
        if (row) setKindDraft(normalizeAkteDocumentKind(row.documentKind));
    }, [kindIdx, anlagen]);

    const processFiles = (list: FileList | null) => {
        if (!canManageAnlagen) return;
        const f = list?.[0];
        if (f) onPickFile(f);
    };

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        processFiles(e.dataTransfer.files);
    };

    return (
        <div className="akte-anlagen-wrap col" style={{ gap: 16 }}>
            <CardHeader title={title} subtitle={subtitle} />
            <input
                id={fileInputId}
                type="file"
                className="sr-only"
                accept={anlageInputAccept()}
                onChange={(e) => {
                    processFiles(e.target.files);
                    e.currentTarget.value = "";
                }}
            />
            <input
                id={cameraInputId}
                type="file"
                className="sr-only"
                accept={anlageCameraInputAccept()}
                capture="environment"
                onChange={(e) => {
                    processFiles(e.target.files);
                    e.currentTarget.value = "";
                }}
            />
            <div
                className={`akte-anlagen-dropzone${dragOver ? " akte-anlagen-dropzone--active" : ""}${!canManageAnlagen ? " akte-anlagen-dropzone--disabled" : ""}`}
                onDragOver={(e) => {
                    if (!canManageAnlagen) return;
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={canManageAnlagen ? onDrop : (e) => { e.preventDefault(); setDragOver(false); }}
            >
                <div className="akte-anlagen-dropzone__inner col" style={{ alignItems: "center", gap: 12 }}>
                    <UploadCircleIcon size={44} />
                    <div className="col" style={{ alignItems: "center", gap: 4, textAlign: "center" }}>
                        <span className="akte-anlagen-dropzone__title">Datei hochladen</span>
                        <span className="akte-anlagen-dropzone__hint">
                            Röntgenbilder, Einverständniserklärungen, Fotos · PDF, JPG, PNG, DCM bis 50 MB
                        </span>
                    </div>
                    <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                        <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            disabled={!canManageAnlagen}
                            onClick={() => canManageAnlagen && document.getElementById(fileInputId)?.click()}
                        >
                            <PlusIcon size={14} /> Datei wählen
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={!canManageAnlagen}
                            onClick={() => canManageAnlagen && document.getElementById(cameraInputId)?.click()}
                        >
                            <PlusIcon size={14} /> Foto / Kamera
                        </Button>
                        <Button type="button" size="sm" variant="secondary" disabled={!canManageAnlagen} onClick={onScannerClick}>
                            <BoltIcon size={14} /> Scanner
                        </Button>
                    </div>
                </div>
            </div>

            {anlagen.length > 0 ? (
                <div className="akte-anlagen-grid">
                    {anlagen.map((a, idx) => {
                        const tone = PREVIEW_TONE[idx % PREVIEW_TONE.length];
                        const badge = anlageBadgeExt(a.name, a.mimeType);
                        const showImg = isAnlageImagePreview(a.mimeType, a.name);
                        const validated = isValidated(a.id);

                        return (
                            <article key={a.id} className="anlage-card">
                                <div
                                    className="anlage-card__preview"
                                    style={{ background: tone.grad }}
                                >
                                    <span className="anlage-card__badge">{badge}</span>
                                    <div className="anlage-card__preview-body">
                                        {showImg ? (
                                            <img src={a.previewUrl} alt="" className="anlage-card__thumb" loading="lazy" />
                                        ) : (
                                            <AnlageDocGlyph color={tone.doc} />
                                        )}
                                    </div>
                                </div>
                                <div className="anlage-card__footer">
                                    <div className="anlage-card__meta col" style={{ minWidth: 0, gap: 2 }}>
                                        <span
                                            className="anlage-card__title-input"
                                            style={{ fontWeight: 600, wordBreak: "break-word" as const }}
                                        >
                                            {a.name}
                                        </span>
                                        <span className="anlage-card__sub">
                                            {labelForAkteDocumentKind(a.documentKind)}
                                            {" · "}
                                            {formatAddedAt(a.addedAt)} · {formatAnlageBytes(a.sizeBytes)}
                                        </span>
                                    </div>
                                    <AnlageCardMenu
                                        validated={validated}
                                        canValidate={canValidate}
                                        onValidate={() => onRequestValidate(a.id, `Anlage ${a.name}`)}
                                        onRevokeValidate={() => onRevokeValidation(a.id, a.name)}
                                        onOpenExternal={
                                            onOpenExternal && a.absPath ? () => onOpenExternal(idx) : undefined
                                        }
                                        onDuplicate={
                                            canManageAnlagen && onDuplicate && a.absPath
                                                ? () => onDuplicate(idx)
                                                : undefined
                                        }
                                        onRenameTitle={
                                            canManageAnlagen ? () => setRenameIdx(idx) : undefined
                                        }
                                        onChangeKind={
                                            canManageAnlagen && onSetDocumentKind
                                                ? () => setKindIdx(idx)
                                                : undefined
                                        }
                                        onRemove={
                                            canManageAnlagen ? () => onRequestRemove(idx, a.name) : undefined
                                        }
                                    />
                                </div>
                            </article>
                        );
                    })}
                </div>
            ) : null}

            <Dialog
                open={renameIdx !== null}
                onClose={() => setRenameIdx(null)}
                title="Bezeichnung ändern"
                footer={
                    <>
                        <Button type="button" variant="ghost" onClick={() => setRenameIdx(null)}>
                            Abbrechen
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (renameIdx === null) return;
                                const v = renameDraft.trim();
                                if (!v) return;
                                onRename(renameIdx, v);
                                setRenameIdx(null);
                            }}
                        >
                            Speichern
                        </Button>
                    </>
                }
            >
                {renameIdx !== null && anlagen[renameIdx] ? (
                    <Input
                        label="Bezeichnung in der Akte"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        className="input-edit"
                        autoComplete="off"
                        autoFocus
                    />
                ) : null}
            </Dialog>

            <Dialog
                open={kindIdx !== null}
                onClose={() => setKindIdx(null)}
                title="Dokumenttyp"
                footer={
                    <>
                        <Button type="button" variant="ghost" onClick={() => setKindIdx(null)}>
                            Abbrechen
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (kindIdx === null || !onSetDocumentKind) return;
                                onSetDocumentKind(kindIdx, normalizeAkteDocumentKind(kindDraft));
                                setKindIdx(null);
                            }}
                        >
                            Übernehmen
                        </Button>
                    </>
                }
            >
                <div className="col" style={{ gap: 8 }}>
                    <label className="text-caption text-on-surface-variant" htmlFor="anlage-kind-select-panel">
                        Kategorie
                    </label>
                    <select
                        id="anlage-kind-select-panel"
                        className="input-edit"
                        value={kindDraft}
                        onChange={(e) => setKindDraft(e.target.value)}
                    >
                        {AKTE_ANLAGE_DOCUMENT_KINDS.map((k) => (
                            <option key={k.id} value={k.id}>
                                {k.label}
                            </option>
                        ))}
                    </select>
                </div>
            </Dialog>
        </div>
    );
}
