import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";
import { useDismissibleLayer } from "./ui/use-dismissible-layer";
import { BoltIcon, MoreIcon, PlusIcon, ShieldCheckIcon, UploadCircleIcon } from "@/lib/icons";
import type { ChartAttachment } from "@/lib/chart-attachments";
import {
    CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT,
    CHART_ATTACHMENT_DOCUMENT_KINDS,
    attachmentBadgeExt,
    formatAttachmentBytes,
    isAttachmentImagePreview,
    labelForChartDocumentKind,
    normalizeChartDocumentKind,
    attachmentCameraInputAccept,
    attachmentInputAccept,
} from "@/lib/chart-attachments";

const PREVIEW_TONE = [
    { grad: "linear-gradient(165deg, #e8f4fc 0%, #d4e8f8 55%, #c5dff5 100%)", doc: "#1a73e8" },
    { grad: "linear-gradient(165deg, #e8faf0 0%, #d4f3e3 55%, #c5ebd8 100%)", doc: "#0d9f5f" },
    { grad: "linear-gradient(165deg, #fff4e8 0%, #ffe8d4 55%, #ffdfc5 100%)", doc: "#c45c00" },
    { grad: "linear-gradient(165deg, #f4ecfc 0%, #e8dcf8 55%, #dcc9f2 100%)", doc: "#7c3aed" },
];

function AttachmentDocGlyph({ color }: { color: string }) {
    return (
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M7 3h7l5 5v13H7V3z" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M14 3v5h5" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M9 13h6M9 17h4" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
    );
}

function AttachmentCardMenu({
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
    const t = useT();
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    useDismissibleLayer({ open, rootRef, onDismiss: () => setOpen(false) });

    return (
        <div ref={rootRef} style={{ position: "relative" }}>
            <button
                type="button"
                className="attachment-card__more"
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={t("common.actions")}
                onClick={() => setOpen((o) => !o)}
            >
                <MoreIcon size={18} />
            </button>
            {open ? (
                <div className="attachment-card__menu" role="menu">
                    {onOpenExternal ? (
                        <button type="button" role="menuitem" className="attachment-card__menu-item" onClick={() => { onOpenExternal(); setOpen(false); }}>
                            {t("chart.attachments.open_external")}
                        </button>
                    ) : null}
                    {onDuplicate ? (
                        <button type="button" role="menuitem" className="attachment-card__menu-item" onClick={() => { onDuplicate(); setOpen(false); }}>
                            {t("chart.attachments.duplicate")}
                        </button>
                    ) : null}
                    {onRenameTitle ? (
                        <button type="button" role="menuitem" className="attachment-card__menu-item" onClick={() => { onRenameTitle(); setOpen(false); }}>
                            {t("chart.attachments.rename")}
                        </button>
                    ) : null}
                    {onChangeKind ? (
                        <button type="button" role="menuitem" className="attachment-card__menu-item" onClick={() => { onChangeKind(); setOpen(false); }}>
                            {t("chart.attachments.set_doc_type")}
                        </button>
                    ) : null}
                    {canValidate ? (
                        validated ? (
                            <button type="button" role="menuitem" className="attachment-card__menu-item" onClick={() => { onRevokeValidate(); setOpen(false); }}>
                                {t("chart.attachments.reset_validation")}
                            </button>
                        ) : (
                            <button type="button" role="menuitem" className="attachment-card__menu-item" onClick={() => { onValidate(); setOpen(false); }}>
                                <ShieldCheckIcon size={14} /> {t("chart.attachments.validate")}
                            </button>
                        )
                    ) : null}
                    {onRemove ? (
                        <button
                            type="button"
                            role="menuitem"
                            className="attachment-card__menu-item attachment-card__menu-item--danger"
                            onClick={() => {
                                onRemove();
                                setOpen(false);
                            }}
                        >
                            {t("common.remove")}
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export type ChartAttachmentsPanelProps = {
    title?: string;
    subtitle: string;
    attachments: ChartAttachment[];
    fileInputId: string;
    cameraInputId: string;
    /** Upload, rename, delete, duplicate (e.g. `patient.write_medical`) */
    canManageAttachments: boolean;
    onPickFile: (file: File) => void;
    /** Rename via menu "Change label …". */
    onRename: (idx: number, name: string) => void;
    onSetDocumentKind?: (idx: number, kind: string) => void;
    onRequestRemove: (idx: number, name: string) => void;
    onOpenExternal?: (idx: number) => void;
    onDuplicate?: (idx: number) => void;
    canValidate: boolean;
    isValidated: (attachmentId: string) => boolean;
    onRequestValidate: (attachmentId: string, label: string) => void;
    onRevokeValidation: (attachmentId: string, shortLabel: string) => void;
    formatAddedAt: (iso: string) => string;
    onScannerClick: () => void;
};

export function ChartAttachmentsPanel({
    title,
    subtitle,
    attachments,
    fileInputId,
    cameraInputId,
    canManageAttachments,
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
}: ChartAttachmentsPanelProps) {
    const t = useT();
    const tp = useTParams();
    const panelTitle = title ?? t("chart.attachments.default_title");
    const [dragOver, setDragOver] = useState(false);
    const [renameIdx, setRenameIdx] = useState<number | null>(null);
    const [renameDraft, setRenameDraft] = useState("");
    const [kindIdx, setKindIdx] = useState<number | null>(null);
    const [kindDraft, setKindDraft] = useState(CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT);

    useEffect(() => {
        if (renameIdx === null) return;
        const row = attachments[renameIdx];
        if (row) setRenameDraft(row.name);
    }, [renameIdx, attachments]);

    useEffect(() => {
        if (kindIdx === null) return;
        const row = attachments[kindIdx];
        if (row) setKindDraft(normalizeChartDocumentKind(row.documentKind));
    }, [kindIdx, attachments]);

    const processFiles = (list: FileList | null) => {
        if (!canManageAttachments) return;
        const f = list?.[0];
        if (f) onPickFile(f);
    };

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        processFiles(e.dataTransfer.files);
    };

    return (
        <div className="chart-attachments-wrap col" style={{ gap: 16 }}>
            <CardHeader title={panelTitle} subtitle={subtitle} />
            <input
                id={fileInputId}
                type="file"
                className="sr-only"
                accept={attachmentInputAccept()}
                onChange={(e) => {
                    processFiles(e.target.files);
                    e.currentTarget.value = "";
                }}
            />
            <input
                id={cameraInputId}
                type="file"
                className="sr-only"
                accept={attachmentCameraInputAccept()}
                capture="environment"
                onChange={(e) => {
                    processFiles(e.target.files);
                    e.currentTarget.value = "";
                }}
            />
            <div
                className={`chart-attachments-dropzone${dragOver ? " chart-attachments-dropzone--active" : ""}${!canManageAttachments ? " chart-attachments-dropzone--disabled" : ""}`}
                onDragOver={(e) => {
                    if (!canManageAttachments) return;
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={canManageAttachments ? onDrop : (e) => { e.preventDefault(); setDragOver(false); }}
            >
                <div className="chart-attachments-dropzone__inner col" style={{ alignItems: "center", gap: 12 }}>
                    <UploadCircleIcon size={44} />
                    <div className="col" style={{ alignItems: "center", gap: 4, textAlign: "center" }}>
                        <span className="chart-attachments-dropzone__title">{t("chart.attachments.upload_title")}</span>
                        <span className="chart-attachments-dropzone__hint">
                            {t("chart.attachments.upload_hint")}
                        </span>
                    </div>
                    <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                        <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            disabled={!canManageAttachments}
                            onClick={() => canManageAttachments && document.getElementById(fileInputId)?.click()}
                        >
                            <PlusIcon size={14} /> {t("patient.chart.pick_file")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={!canManageAttachments}
                            onClick={() => canManageAttachments && document.getElementById(cameraInputId)?.click()}
                        >
                            <PlusIcon size={14} /> {t("chart.attachments.photo_camera")}
                        </Button>
                        <Button type="button" size="sm" variant="secondary" disabled={!canManageAttachments} onClick={onScannerClick}>
                            <BoltIcon size={14} /> {t("chart.attachments.scanner")}
                        </Button>
                    </div>
                </div>
            </div>

            {attachments.length > 0 ? (
                <div className="chart-attachments-grid">
                    {attachments.map((a, idx) => {
                        const tone = PREVIEW_TONE[idx % PREVIEW_TONE.length];
                        const badge = attachmentBadgeExt(a.name, a.mimeType);
                        const showImg = isAttachmentImagePreview(a.mimeType, a.name);
                        const validated = isValidated(a.id);

                        return (
                            <article key={a.id} className="attachment-card">
                                <div
                                    className="attachment-card__preview"
                                    style={{ background: tone.grad }}
                                >
                                    <span className="attachment-card__badge">{badge}</span>
                                    <div className="attachment-card__preview-body">
                                        {showImg ? (
                                            <img src={a.previewUrl} alt="" className="attachment-card__thumb" loading="lazy" />
                                        ) : (
                                            <AttachmentDocGlyph color={tone.doc} />
                                        )}
                                    </div>
                                </div>
                                <div className="attachment-card__footer">
                                    <div className="attachment-card__meta col" style={{ minWidth: 0, gap: 2 }}>
                                        <span
                                            className="attachment-card__title-input"
                                            style={{ fontWeight: 600, wordBreak: "break-word" as const }}
                                        >
                                            {a.name}
                                        </span>
                                        <span className="attachment-card__sub">
                                            {labelForChartDocumentKind(t, a.documentKind)}
                                            {" · "}
                                            {formatAddedAt(a.addedAt)} · {formatAttachmentBytes(a.sizeBytes)}
                                        </span>
                                    </div>
                                    <AttachmentCardMenu
                                        validated={validated}
                                        canValidate={canValidate}
                                        onValidate={() =>
                                            onRequestValidate(a.id, tp("chart.attachments.validate_label", { name: a.name }))
                                        }
                                        onRevokeValidate={() => onRevokeValidation(a.id, a.name)}
                                        onOpenExternal={
                                            onOpenExternal && a.absPath ? () => onOpenExternal(idx) : undefined
                                        }
                                        onDuplicate={
                                            canManageAttachments && onDuplicate && a.absPath
                                                ? () => onDuplicate(idx)
                                                : undefined
                                        }
                                        onRenameTitle={
                                            canManageAttachments ? () => setRenameIdx(idx) : undefined
                                        }
                                        onChangeKind={
                                            canManageAttachments && onSetDocumentKind
                                                ? () => setKindIdx(idx)
                                                : undefined
                                        }
                                        onRemove={
                                            canManageAttachments ? () => onRequestRemove(idx, a.name) : undefined
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
                title={t("patient.chart.rename_title")}
                footer={
                    <>
                        <Button type="button" variant="ghost" onClick={() => setRenameIdx(null)}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (renameIdx === null) return;
                                const version = renameDraft.trim();
                                if (!version) return;
                                onRename(renameIdx, version);
                                setRenameIdx(null);
                            }}
                        >
                            {t("common.save")}
                        </Button>
                    </>
                }
            >
                {renameIdx !== null && attachments[renameIdx] ? (
                    <Input
                        label={t("chart.attachments.label_in_record")}
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
                title={t("chart.attachments.doc_type")}
                footer={
                    <>
                        <Button type="button" variant="ghost" onClick={() => setKindIdx(null)}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            onClick={() => {
                                if (kindIdx === null || !onSetDocumentKind) return;
                                onSetDocumentKind(kindIdx, normalizeChartDocumentKind(kindDraft));
                                setKindIdx(null);
                            }}
                        >
                            {t("chart.attachments.apply")}
                        </Button>
                    </>
                }
            >
                <div className="col" style={{ gap: 8 }}>
                    <label className="text-caption text-on-surface-variant" htmlFor="attachment-kind-select-panel">
                        {t("chart.attachments.category")}
                    </label>
                    <select
                        id="attachment-kind-select-panel"
                        className="input-edit"
                        value={kindDraft}
                        onChange={(e) => setKindDraft(e.target.value)}
                    >
                        {CHART_ATTACHMENT_DOCUMENT_KINDS.map((k) => (
                            <option key={k.id} value={k.id}>
                                {t(k.labelKey)}
                            </option>
                        ))}
                    </select>
                </div>
            </Dialog>
        </div>
    );
}
