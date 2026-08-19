import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import {
    listDocumentTemplates,
    createDocumentTemplate,
    updateDocumentTemplate,
    deleteDocumentTemplate,
} from "@/systems/practice-host/controllers/practice.controller";
import { useFormDirtyStore } from "../../models/store/form-dirty-store";
import { errorMessage } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { Input, Select, Textarea } from "../components/ui/input";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { MEDICATION_SUGGESTIONS } from "@/lib/medications";
import { ILLNESS_SUGGESTION_KEYS } from "@/lib/certificate-composer";
import type { DocumentTemplate } from "../../models/types";
import { normalizeDocumentTemplateKind } from "../../models/types";

const MEDICATIONS_RAW =
    MEDICATION_SUGGESTIONS.length > 0
        ? MEDICATION_SUGGESTIONS.map((s) => ({ value: s.label, label: s.label }))
        : null;


type PrescriptionItem = { medication: string; dosage: string; description: string };

export type TemplateEditorPanelProps =
    | {
          editingId: null;
          newTemplateKind: "PRESCRIPTION" | "CERTIFICATE";
          canWrite: boolean;
          onClose: () => void;
          onSaved: () => void;
      }
    | {
          editingId: string;
          canWrite: boolean;
          onClose: () => void;
          onSaved: () => void;
      };

/**
 * Embedded editor for prescription/certificate templates (right column on "Prescriptions und Certificates vordefinieren").
 * No standalone page — removed route redirects via `TemplateEditorPage` with query parameters.
 */
export function TemplateEditorPanel(props: TemplateEditorPanelProps) {
    const t = useT();
    const { canWrite, onClose, onSaved } = props;
    const editingId = props.editingId;
    const newTemplateKind = "newTemplateKind" in props ? props.newTemplateKind : null;
    const toast = useToastStore((s) => s.add);
    const setGlobalDirty = useFormDirtyStore((s) => s.setDirty);
    const [loading, setLoading] = useState(true);
    const [kind, setKind] = useState<"PRESCRIPTION" | "CERTIFICATE">("PRESCRIPTION");
    const [title, setTitle] = useState("");
    const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([]);
    const medicationsOptions = useMemo(
        () => MEDICATIONS_RAW ?? [{ value: "", label: t("template.editor.med_no_suggestions") }],
        [t],
    );
    const illnessSuggestions = useMemo(
        () => ILLNESS_SUGGESTION_KEYS.map((k) => t(k)),
        [t],
    );
    const defaultIllness = illnessSuggestions[0] ?? "";
    const defaultMedPick = medicationsOptions[0]?.value ?? "";
    const [medPick, setMedPick] = useState(defaultMedPick);
    const [dosage, setDosage] = useState("");
    const [description, setDescription] = useState("");
    const [krankheiten, setKrankheiten] = useState(defaultIllness);
    const [tageAnzahl, setTageAnzahl] = useState("");
    const [einschraenkung, setEinschraenkung] = useState("");
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [lineRemoveIdx, setLineRemoveIdx] = useState<number | null>(null);
    /** Saved form signature after load (null = loading / no baseline). */
    const [baselineSig, setBaselineSig] = useState<string | null>(null);

    const applyRow = useCallback((row: DocumentTemplate) => {
        const kind = normalizeDocumentTemplateKind(row.kind) ?? "PRESCRIPTION";
        setKind(kind);
        setTitle(row.title);
        try {
            const p = JSON.parse(row.payload) as Record<string, unknown>;
            if (kind === "PRESCRIPTION") {
                const items = p.items as PrescriptionItem[] | undefined;
                setPrescriptionItems(Array.isArray(items) ? items : []);
                setKrankheiten(defaultIllness);
                setTageAnzahl("");
                setEinschraenkung("");
            } else {
                setPrescriptionItems([]);
                setKrankheiten(String(p.krankheiten || defaultIllness));
                const rawTage = p.tage_anzahl;
                setTageAnzahl(
                    rawTage === undefined || rawTage === null ? "" : String(rawTage),
                );
                setEinschraenkung(String(p.einschraenkung ?? ""));
            }
        } catch {
            setPrescriptionItems([]);
            setKrankheiten(defaultIllness);
            setTageAnzahl("");
            setEinschraenkung("");
        }
        setMedPick(defaultMedPick);
        setDosage("");
        setDescription("");
    }, [defaultMedPick, defaultIllness]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (editingId === null) {
                setKind(newTemplateKind ?? "PRESCRIPTION");
                setTitle("");
                setPrescriptionItems([]);
                setDosage("");
                setDescription("");
                setTageAnzahl("");
                setEinschraenkung("");
                setKrankheiten(defaultIllness);
                setMedPick(defaultMedPick);
                return;
            }
            const all = await listDocumentTemplates();
            const row = all.find((r) => r.id === editingId);
            if (!row) {
                toast(t("template.editor.not_found"), "error");
                onClose();
                return;
            }
            applyRow(row);
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        } finally {
            setLoading(false);
        }
    }, [editingId, newTemplateKind, applyRow, onClose, toast, defaultMedPick, defaultIllness, t]);

    useEffect(() => {
        void load();
    }, [load]);

    useLayoutEffect(() => {
        if (loading) setBaselineSig(null);
    }, [loading]);

    const currentSig = useMemo(
        () =>
            JSON.stringify({
                kind,
                title,
                prescriptionItems,
                krankheiten,
                tageAnzahl,
                einschraenkung,
            }),
        [kind, title, prescriptionItems, krankheiten, tageAnzahl, einschraenkung],
    );

    useLayoutEffect(() => {
        if (!loading) {
            setBaselineSig((b) => (b === null ? currentSig : b));
        }
    }, [loading, currentSig]);

    const isDirty = !loading && baselineSig !== null && currentSig !== baselineSig;

    useEffect(() => {
        setGlobalDirty(isDirty);
        return () => setGlobalDirty(false);
    }, [isDirty, setGlobalDirty]);

    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (useFormDirtyStore.getState().dirty) e.preventDefault();
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    const addPrescriptionLine = () => {
        const med = medPick.trim();
        if (!med) return;
        if (!dosage.trim()) {
            toast(t("template.editor.dosage_required"), "error");
            return;
        }
        const key = med.toLowerCase();
        if (prescriptionItems.some((it) => it.medication.trim().toLowerCase() === key)) {
            toast(t("template.editor.duplicate_med"), "error");
            return;
        }
        setPrescriptionItems((prev) => [
            ...prev,
            { medication: med, dosage: dosage.trim(), description: description.trim() },
        ]);
        setDosage("");
        setDescription("");
    };

    const removePrescriptionLineConfirmed = () => {
        if (lineRemoveIdx === null) return;
        const idx = lineRemoveIdx;
        setLineRemoveIdx(null);
        setPrescriptionItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const buildPayload = (): Record<string, unknown> => {
        if (kind === "PRESCRIPTION") return { items: prescriptionItems };
        const n = Number.parseInt(tageAnzahl.trim(), 10);
        return {
            krankheiten,
            tage_anzahl: Number.isFinite(n) ? n : tageAnzahl.trim(),
            einschraenkung: einschraenkung.trim(),
        };
    };

    const save = async () => {
        if (!canWrite) return;
        if (!title.trim()) {
            toast(t("template.editor.title_required"), "error");
            return;
        }
        if (kind === "PRESCRIPTION" && prescriptionItems.length === 0) {
            toast(t("template.editor.min_one_line"), "error");
            return;
        }
        if (kind === "CERTIFICATE") {
            const raw = tageAnzahl.trim();
            const n = Number.parseInt(raw, 10);
            if (!raw || !Number.isFinite(n) || n < 1 || n > 366) {
                toast(t("template.editor.days_validation"), "error");
                return;
            }
        }
        try {
            const payload = buildPayload();
            if (editingId !== null) {
                await updateDocumentTemplate(editingId, { title: title.trim(), payload });
                toast(t("template.editor.toast.saved"));
            } else {
                await createDocumentTemplate({ kind, title: title.trim(), payload });
                toast(t("template.editor.toast.created"));
            }
            setBaselineSig(currentSig);
            setGlobalDirty(false);
            onSaved();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        }
    };

    const runReset = () => {
        setResetOpen(false);
        void load();
    };

    const removeTemplate = async () => {
        if (editingId === null) return;
        try {
            await deleteDocumentTemplate(editingId);
            toast(t("template.editor.toast.deleted"));
            setDeleteOpen(false);
            setBaselineSig(null);
            setGlobalDirty(false);
            onSaved();
            onClose();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        }
    };

    if (loading) {
        return <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14 }}>{t("template.editor.loading")}</p>;
    }

    return (
        <div className="template-editor-panel">
            <ConfirmDialog
                open={deleteOpen}
                title={t("template.editor.delete_confirm_title")}
                message={t("template.editor.delete_confirm_message")}
                confirmLabel={t("common.yes_delete")}
                danger
                onConfirm={() => void removeTemplate()}
                onClose={() => setDeleteOpen(false)}
            />
            <ConfirmDialog
                open={resetOpen}
                title={t("template.editor.reset_title")}
                message={t("template.editor.reset_confirm")}
                confirmLabel={t("common.reset")}
                onConfirm={() => runReset()}
                onClose={() => setResetOpen(false)}
            />
            <ConfirmDialog
                open={lineRemoveIdx !== null}
                title={t("template.editor.remove_line_title")}
                message={t("template.editor.remove_line_confirm")}
                confirmLabel={t("common.remove")}
                danger
                onConfirm={() => removePrescriptionLineConfirmed()}
                onClose={() => setLineRemoveIdx(null)}
            />

            <Input label={t("common.title_field")} value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canWrite} />

            {kind === "PRESCRIPTION" ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginTop: 12 }}>
                        <Select
                            label={t("page.prescriptions.col.medication")}
                            value={medPick}
                            onChange={(e) => setMedPick(e.target.value)}
                            options={medicationsOptions}
                            disabled={!canWrite}
                        />
                        <Input label={t("page.prescriptions.col.dosage")} value={dosage} onChange={(e) => setDosage(e.target.value)} disabled={!canWrite} />
                    </div>
                    <Textarea label={t("common.description")} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={!canWrite} />
                    {canWrite ? (
                        <Button type="button" variant="secondary" style={{ marginTop: 8 }} onClick={addPrescriptionLine}>
                            {t("common.add")}
                        </Button>
                    ) : null}
                    <div style={{ marginTop: 16, border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t("template.editor.lines_title")}</div>
                        {prescriptionItems.length === 0 ? (
                            <p style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("template.editor.lines_empty")}</p>
                        ) : (
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                {prescriptionItems.map((it, idx) => (
                                    <li
                                        key={`${it.medication}-${idx}`}
                                        className="row"
                                        style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}
                                    >
                                        <span style={{ fontSize: 13 }}>
                                            {it.medication} — {it.dosage || t("common.em_dash")}
                                        </span>
                                        {canWrite ? (
                                            <button type="button" className="btn btn-ghost" onClick={() => setLineRemoveIdx(idx)}>
                                                {t("common.remove")}
                                            </button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <datalist id="ve-krankheiten-suggestions-embedded">
                        {illnessSuggestions.map((label) => (
                            <option key={label} value={label} />
                        ))}
                    </datalist>
                    <Input
                        label={t("template.editor.diseases")}
                        list="ve-krankheiten-suggestions-embedded"
                        value={krankheiten}
                        onChange={(e) => setKrankheiten(e.target.value)}
                        disabled={!canWrite}
                        placeholder={t("template.editor.diseases_ph")}
                    />
                    <Input
                        label={t("template.editor.days_count")}
                        type="number"
                        min={1}
                        max={366}
                        inputMode="numeric"
                        value={tageAnzahl}
                        onChange={(e) => setTageAnzahl(e.target.value)}
                        disabled={!canWrite}
                    />
                    <Textarea label={t("template.editor.activity_limit")} value={einschraenkung} onChange={(e) => setEinschraenkung(e.target.value)} rows={4} disabled={!canWrite} />
                </>
            )}

            {canWrite ? (
                <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                    {editingId !== null ? (
                        <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                            {t("common.delete")}
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            if (isDirty) setResetOpen(true);
                            else void load();
                        }}
                    >
                        {t("common.reset")}
                    </Button>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        {t("common.close")}
                    </Button>
                    <Button type="button" onClick={() => void save()}>
                        {kind === "PRESCRIPTION" ? t("template.editor.save_prescription") : t("template.editor.save_certificate")}
                    </Button>
                </div>
            ) : (
                <p style={{ color: "var(--fg-3)", marginTop: 16 }}>{t("common.read_only")}</p>
            )}
        </div>
    );
}

/** Backward compatible: old `/administration/templates/editor` URLs → list-based with query parameters. */
export function TemplateEditorPage() {
    const { id } = useParams<{ id: string }>();
    const [sp] = useSearchParams();
    const kind = sp.get("kind");
    if (id) {
        return <Navigate to={`/administration/templates?bearbeiten=${encodeURIComponent(id)}`} replace />;
    }
    if (kind?.toLowerCase() === "certificate") {
        return <Navigate to="/administration/templates?new=certificate" replace />;
    }
    return <Navigate to="/administration/templates?new=prescription" replace />;
}
