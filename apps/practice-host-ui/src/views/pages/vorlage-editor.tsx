import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import {
    listDokumentVorlagen,
    createDokumentVorlage,
    updateDokumentVorlage,
    deleteDokumentVorlage,
} from "@/systems/practice-host/controllers/praxis.controller";
import { useFormDirtyStore } from "../../models/store/form-dirty-store";
import { errorMessage } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { Input, Select, Textarea } from "../components/ui/input";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { MEDIKAMENT_SUGGESTIONS } from "@/lib/medikamente";
import { ILLNESS_SUGGESTION_KEYS } from "@/lib/attest-composer";
import type { DokumentVorlage } from "../../models/types";

const MEDIKAMENTE_RAW =
    MEDIKAMENT_SUGGESTIONS.length > 0
        ? MEDIKAMENT_SUGGESTIONS.map((s) => ({ value: s.label, label: s.label }))
        : null;


type RezeptItem = { medikament: string; dosierung: string; beschreibung: string };

export type VorlageEditorPanelProps =
    | {
          editingId: null;
          newTemplateKind: "REZEPT" | "ATTEST";
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
 * Embedded editor for prescription/certificate templates (right column on "Rezepte und Atteste vordefinieren").
 * No standalone page — removed route redirects via `VorlageEditorPage` with query parameters.
 */
export function VorlageEditorPanel(props: VorlageEditorPanelProps) {
    const t = useT();
    const { canWrite, onClose, onSaved } = props;
    const editingId = props.editingId;
    const newTemplateKind = "newTemplateKind" in props ? props.newTemplateKind : null;
    const toast = useToastStore((s) => s.add);
    const setGlobalDirty = useFormDirtyStore((s) => s.setDirty);
    const [loading, setLoading] = useState(true);
    const [kind, setKind] = useState<"REZEPT" | "ATTEST">("REZEPT");
    const [titel, setTitel] = useState("");
    const [rezeptItems, setRezeptItems] = useState<RezeptItem[]>([]);
    const medikamenteOptions = useMemo(
        () => MEDIKAMENTE_RAW ?? [{ value: "", label: t("vorlage.editor.med_no_suggestions") }],
        [t],
    );
    const illnessSuggestions = useMemo(
        () => ILLNESS_SUGGESTION_KEYS.map((k) => t(k)),
        [t],
    );
    const defaultIllness = illnessSuggestions[0] ?? "";
    const defaultMedPick = medikamenteOptions[0]?.value ?? "";
    const [medPick, setMedPick] = useState(defaultMedPick);
    const [dosierung, setDosierung] = useState("");
    const [beschreibung, setBeschreibung] = useState("");
    const [krankheiten, setKrankheiten] = useState(defaultIllness);
    const [tageAnzahl, setTageAnzahl] = useState("");
    const [einschraenkung, setEinschraenkung] = useState("");
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [lineRemoveIdx, setLineRemoveIdx] = useState<number | null>(null);
    /** Saved form signature after load (null = loading / no baseline). */
    const [baselineSig, setBaselineSig] = useState<string | null>(null);

    const applyRow = useCallback((row: DokumentVorlage) => {
        setKind(row.kind);
        setTitel(row.titel);
        try {
            const p = JSON.parse(row.payload) as Record<string, unknown>;
            if (row.kind === "REZEPT") {
                const items = p.items as RezeptItem[] | undefined;
                setRezeptItems(Array.isArray(items) ? items : []);
                setKrankheiten(defaultIllness);
                setTageAnzahl("");
                setEinschraenkung("");
            } else {
                setRezeptItems([]);
                setKrankheiten(String(p.krankheiten || defaultIllness));
                const rawTage = p.tage_anzahl;
                setTageAnzahl(
                    rawTage === undefined || rawTage === null ? "" : String(rawTage),
                );
                setEinschraenkung(String(p.einschraenkung ?? ""));
            }
        } catch {
            setRezeptItems([]);
            setKrankheiten(defaultIllness);
            setTageAnzahl("");
            setEinschraenkung("");
        }
        setMedPick(defaultMedPick);
        setDosierung("");
        setBeschreibung("");
    }, [defaultMedPick, defaultIllness]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (editingId === null) {
                setKind(newTemplateKind ?? "REZEPT");
                setTitel("");
                setRezeptItems([]);
                setDosierung("");
                setBeschreibung("");
                setTageAnzahl("");
                setEinschraenkung("");
                setKrankheiten(defaultIllness);
                setMedPick(defaultMedPick);
                return;
            }
            const all = await listDokumentVorlagen();
            const row = all.find((r) => r.id === editingId);
            if (!row) {
                toast(t("vorlage.editor.not_found"), "error");
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
                titel,
                rezeptItems,
                krankheiten,
                tageAnzahl,
                einschraenkung,
            }),
        [kind, titel, rezeptItems, krankheiten, tageAnzahl, einschraenkung],
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

    const addRezeptLine = () => {
        const med = medPick.trim();
        if (!med) return;
        if (!dosierung.trim()) {
            toast(t("vorlage.editor.dosage_required"), "error");
            return;
        }
        const key = med.toLowerCase();
        if (rezeptItems.some((it) => it.medikament.trim().toLowerCase() === key)) {
            toast(t("vorlage.editor.duplicate_med"), "error");
            return;
        }
        setRezeptItems((prev) => [
            ...prev,
            { medikament: med, dosierung: dosierung.trim(), beschreibung: beschreibung.trim() },
        ]);
        setDosierung("");
        setBeschreibung("");
    };

    const removeRezeptLineConfirmed = () => {
        if (lineRemoveIdx === null) return;
        const idx = lineRemoveIdx;
        setLineRemoveIdx(null);
        setRezeptItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const buildPayload = (): Record<string, unknown> => {
        if (kind === "REZEPT") return { items: rezeptItems };
        const n = Number.parseInt(tageAnzahl.trim(), 10);
        return {
            krankheiten,
            tage_anzahl: Number.isFinite(n) ? n : tageAnzahl.trim(),
            einschraenkung: einschraenkung.trim(),
        };
    };

    const save = async () => {
        if (!canWrite) return;
        if (!titel.trim()) {
            toast(t("vorlage.editor.title_required"), "error");
            return;
        }
        if (kind === "REZEPT" && rezeptItems.length === 0) {
            toast(t("vorlage.editor.min_one_line"), "error");
            return;
        }
        if (kind === "ATTEST") {
            const raw = tageAnzahl.trim();
            const n = Number.parseInt(raw, 10);
            if (!raw || !Number.isFinite(n) || n < 1 || n > 366) {
                toast(t("vorlage.editor.days_validation"), "error");
                return;
            }
        }
        try {
            const payload = buildPayload();
            if (editingId !== null) {
                await updateDokumentVorlage(editingId, { titel: titel.trim(), payload });
                toast(t("vorlage.editor.toast.saved"));
            } else {
                await createDokumentVorlage({ kind, titel: titel.trim(), payload });
                toast(t("vorlage.editor.toast.created"));
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
            await deleteDokumentVorlage(editingId);
            toast(t("vorlage.editor.toast.deleted"));
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
        return <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14 }}>{t("vorlage.editor.loading")}</p>;
    }

    return (
        <div className="vorlage-editor-panel">
            <ConfirmDialog
                open={deleteOpen}
                title={t("vorlage.editor.delete_confirm_title")}
                message={t("vorlage.editor.delete_confirm_message")}
                confirmLabel={t("common.yes_delete")}
                danger
                onConfirm={() => void removeTemplate()}
                onClose={() => setDeleteOpen(false)}
            />
            <ConfirmDialog
                open={resetOpen}
                title={t("vorlage.editor.reset_title")}
                message={t("vorlage.editor.reset_confirm")}
                confirmLabel={t("common.reset")}
                onConfirm={() => runReset()}
                onClose={() => setResetOpen(false)}
            />
            <ConfirmDialog
                open={lineRemoveIdx !== null}
                title={t("vorlage.editor.remove_line_title")}
                message={t("vorlage.editor.remove_line_confirm")}
                confirmLabel={t("common.remove")}
                danger
                onConfirm={() => removeRezeptLineConfirmed()}
                onClose={() => setLineRemoveIdx(null)}
            />

            <Input label={t("common.title_field")} value={titel} onChange={(e) => setTitel(e.target.value)} disabled={!canWrite} />

            {kind === "REZEPT" ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginTop: 12 }}>
                        <Select
                            label={t("page.rezepte.col.medication")}
                            value={medPick}
                            onChange={(e) => setMedPick(e.target.value)}
                            options={medikamenteOptions}
                            disabled={!canWrite}
                        />
                        <Input label={t("page.rezepte.col.dosage")} value={dosierung} onChange={(e) => setDosierung(e.target.value)} disabled={!canWrite} />
                    </div>
                    <Textarea label={t("common.description")} value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={2} disabled={!canWrite} />
                    {canWrite ? (
                        <Button type="button" variant="secondary" style={{ marginTop: 8 }} onClick={addRezeptLine}>
                            {t("common.add")}
                        </Button>
                    ) : null}
                    <div style={{ marginTop: 16, border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t("vorlage.editor.lines_title")}</div>
                        {rezeptItems.length === 0 ? (
                            <p style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("vorlage.editor.lines_empty")}</p>
                        ) : (
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                {rezeptItems.map((it, idx) => (
                                    <li
                                        key={`${it.medikament}-${idx}`}
                                        className="row"
                                        style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}
                                    >
                                        <span style={{ fontSize: 13 }}>
                                            {it.medikament} — {it.dosierung || t("common.em_dash")}
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
                        label={t("vorlage.editor.diseases")}
                        list="ve-krankheiten-suggestions-embedded"
                        value={krankheiten}
                        onChange={(e) => setKrankheiten(e.target.value)}
                        disabled={!canWrite}
                        placeholder={t("vorlage.editor.diseases_ph")}
                    />
                    <Input
                        label={t("vorlage.editor.days_count")}
                        type="number"
                        min={1}
                        max={366}
                        inputMode="numeric"
                        value={tageAnzahl}
                        onChange={(e) => setTageAnzahl(e.target.value)}
                        disabled={!canWrite}
                    />
                    <Textarea label={t("vorlage.editor.activity_limit")} value={einschraenkung} onChange={(e) => setEinschraenkung(e.target.value)} rows={4} disabled={!canWrite} />
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
                        {kind === "REZEPT" ? t("vorlage.editor.save_rezept") : t("vorlage.editor.save_attest")}
                    </Button>
                </div>
            ) : (
                <p style={{ color: "var(--fg-3)", marginTop: 16 }}>{t("common.read_only")}</p>
            )}
        </div>
    );
}

/** Backward compatible: old `/verwaltung/vorlagen/editor` URLs → list-based with query parameters. */
export function VorlageEditorPage() {
    const { id } = useParams<{ id: string }>();
    const [sp] = useSearchParams();
    const kind = sp.get("kind");
    if (id) {
        return <Navigate to={`/verwaltung/vorlagen?bearbeiten=${encodeURIComponent(id)}`} replace />;
    }
    if (kind?.toLowerCase() === "attest") {
        return <Navigate to="/verwaltung/vorlagen?neu=attest" replace />;
    }
    return <Navigate to="/verwaltung/vorlagen?neu=rezept" replace />;
}
