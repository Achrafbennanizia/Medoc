import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import { listDokumentVorlagen } from "@/systems/practice-host/controllers/praxis.controller";
import { createRezept } from "@/systems/practice-host/controllers/rezept.controller";
import { errorMessage } from "@/lib/utils";
import { useLocale, useT, useTParams } from "@/lib/i18n";
import type { DokumentVorlage } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import {
    MEDIKAMENT_SUGGESTIONS,
    DARREICHUNGSFORM_OPTIONS,
    PACKUNGSGROESSE_OPTIONS,
    REZEPT_TYP_OPTIONS,
    DENTAL_ICD10_SUGGESTIONS,
    findSuggestion as findMedSuggestion,
    emptyRezeptLine,
    parseRezeptVorlagePayload,
    vorlageItemsToLines,
    type RezeptLine,
} from "@/lib/medikamente";
import type { Patient } from "../../models/types";

function validateRezeptLine(line: RezeptLine, t: (key: string) => string): string | null {
    if (!line.medikament.trim()) return t("page.rezepte.validation.med_required");
    if (!line.dosierung.trim()) return t("page.rezepte.validation.dosage_required");
    if (!line.dauer.trim()) return t("page.rezepte.validation.duration_required");
    return null;
}

export function RezeptCreatePage() {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const { id: patientId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const session = useAuthStore((s) => s.session);
    const toast = useToastStore((s) => s.add);

    const [patient, setPatient] = useState<Patient | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadingPatient, setLoadingPatient] = useState(true);

    const [vorlagen, setVorlagen] = useState<DokumentVorlage[]>([]);
    const [vorlageSelect, setVorlageSelect] = useState("");

    const [draft, setDraft] = useState<RezeptLine>(emptyRezeptLine);
    const [draftError, setDraftError] = useState<string | null>(null);
    const [lines, setLines] = useState<RezeptLine[]>([]);
    const [shared, setShared] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPatient = useCallback(async () => {
        if (!patientId) return;
        setLoadingPatient(true);
        setLoadError(null);
        try {
            const p = await getPatient(patientId);
            setPatient(p);
        } catch (e) {
            setLoadError(errorMessage(e));
            setPatient(null);
        } finally {
            setLoadingPatient(false);
        }
    }, [patientId]);

    useEffect(() => {
        void loadPatient();
    }, [loadPatient]);

    useEffect(() => {
        let cancelled = false;
        void listDokumentVorlagen()
            .then((all) => {
                if (cancelled) return;
                setVorlagen(all.filter((v) => v.kind === "REZEPT"));
            })
            .catch(() => {
                if (!cancelled) setVorlagen([]);
            });
        return () => { cancelled = true; };
    }, []);

    const applyVorlage = useCallback(
        (vorlageId: string) => {
            if (!vorlageId) return;
            const v = vorlagen.find((x) => x.id === vorlageId);
            if (!v) return;
            const items = parseRezeptVorlagePayload(v.payload);
            const newLines = vorlageItemsToLines(items);
            if (newLines.length === 0) {
                toast(t("page.rezepte.toast.template_no_meds"), "error");
                return;
            }
            setVorlageSelect(vorlageId);
            setLines((prev) => [...prev, ...newLines]);
            setDraftError(null);
            const suffix = newLines.length === 1 ? "" : locale === "de" ? "n" : "s";
            toast(tp("page.rezepte.toast.template_applied", { title: v.titel, count: newLines.length, suffix }));
        },
        [vorlagen, toast, t, tp, locale],
    );

    useEffect(() => {
        const q = searchParams.get("vorlage");
        if (!q || vorlagen.length === 0) return;
        const exists = vorlagen.some((v) => v.id === q);
        if (!exists) return;
        applyVorlage(q);
        navigate({ search: "" }, { replace: true });
    }, [searchParams, vorlagen, applyVorlage, navigate]);

    const vorlageOptions = useMemo(
        () => [{ value: "", label: t("page.rezepte.template_choose") }, ...vorlagen.map((v) => ({ value: v.id, label: v.titel }))],
        [vorlagen, t],
    );

    const vorlagenPreview = useMemo(
        () =>
            vorlagen.map((v) => {
                const n = parseRezeptVorlagePayload(v.payload).filter(
                    (it) => it && typeof it.medikament === "string" && it.medikament.trim().length > 0,
                ).length;
                return { id: v.id, titel: v.titel, n };
            }),
        [vorlagen],
    );

    const pickMed = (label: string) => {
        const sugg = findMedSuggestion(label);
        setDraft((prev) => ({
            ...prev,
            medikament: label,
            wirkstoff: prev.wirkstoff || sugg?.wirkstoff || "",
            dosierung: prev.dosierung || sugg?.dosierung || "",
        }));
    };

    const addLine = () => {
        const err = validateRezeptLine(draft, t);
        if (err) {
            setDraftError(err);
            return;
        }
        setLines((prev) => [...prev, { ...draft }]);
        setDraft(emptyRezeptLine());
        setDraftError(null);
    };

    const removeLine = (idx: number) => {
        setLines((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (!patientId || !session) return;
        const queue: RezeptLine[] = [...lines];
        if (validateRezeptLine(draft, t) === null) queue.push({ ...draft });
        if (queue.length === 0) {
            setDraftError(t("page.rezepte.validation.min_one_line"));
            return;
        }
        setCreating(true);
        setError(null);
        let ok = 0;
        try {
            for (const line of queue) {
                const merged = [line.hinweise, shared].filter((s) => s.trim()).join(" · ");
                const mengeN = Number.parseInt(line.menge.trim(), 10);
                await createRezept({
                    patient_id: patientId,
                    arzt_id: session.user_id,
                    medikament: line.medikament.trim(),
                    wirkstoff: line.wirkstoff.trim() || null,
                    dosierung: line.dosierung.trim(),
                    dauer: line.dauer.trim(),
                    hinweise: merged.trim() || null,
                    pzn: line.pzn.trim() || null,
                    darreichungsform: line.darreichungsform.trim() || null,
                    packungsgroesse: line.packungsgroesse.trim() || null,
                    menge: Number.isFinite(mengeN) && mengeN > 0 ? mengeN : null,
                    aut_idem: line.aut_idem,
                    rezept_typ: line.rezept_typ,
                    icd10_code: line.icd10_code.trim() || null,
                    verordnender_arzt_id: session.user_id,
                });
                ok += 1;
            }
            toast(
                ok === 1 ? t("page.rezepte.toast.created_one") : tp("page.rezepte.toast.created_many", { count: ok }),
                "success",
            );
            navigate(`/patienten/${patientId}#rezept`);
        } catch (e) {
            setError(
                ok > 0
                    ? tp("page.rezepte.toast.create_partial", { created: ok, message: errorMessage(e) })
                    : errorMessage(e),
            );
        } finally {
            setCreating(false);
        }
    };

    if (!patientId) {
        return (
            <div className="animate-fade-in p-4">
                <p className="text-body text-on-surface-variant">{t("page.rezepte.create.no_patient")}</p>
            </div>
        );
    }

    if (loadingPatient) return <PageLoading label={t("page.rezepte.loading_patients")} />;
    if (loadError || !patient) {
        return <PageLoadError message={loadError ?? t("page.rezepte.toast.linked_patient_not_found")} onRetry={() => void loadPatient()} />;
    }

    const nLines = lines.length + (validateRezeptLine(draft, t) === null ? 1 : 0);
    const cannotSave = nLines === 0 || creating;

    return (
        <div className="praxis-workspace-page animate-fade-in">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.rezepte.create.page_title")}
                eyebrow={patient.name}
                back={{ to: `/patienten/${patientId}#rezept`, label: t("patient.detail.title") }}
            />

            <div style={{ maxWidth: 920 }}>
            <Card>
                    <CardHeader
                        title={t("page.rezepte.create.combo_title")}
                        subtitle={t("page.rezepte.create.combo_subtitle")}
                    />
                    <div style={{ padding: "0 16px 16px" }}>
                        {error ? (
                            <p style={{
                                color: "var(--red)", fontSize: 12.5, margin: "0 0 12px",
                                padding: "8px 12px", background: "var(--red-soft)", borderRadius: 8,
                            }}>
                                {error}
                            </p>
                        ) : null}

                        <div className="rezept-vorlagen-panel">
                            <div className="form-overline">
                                {t("page.rezepte.create.templates_section")}
                            </div>
                            {vorlagen.length > 0 ? (
                                <>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end" style={{ marginBottom: 10 }}>
                                        <div className="flex-1 min-w-0">
                                            <Select
                                                id="rc-vorlage"
                                                label={t("page.rezepte.create.template_label")}
                                                value={vorlageSelect}
                                                options={vorlageOptions}
                                                onChange={(e) => setVorlageSelect(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={!vorlageSelect}
                                            onClick={() => applyVorlage(vorlageSelect)}
                                        >
                                            {t("page.rezepte.create.insert_btn")}
                                        </Button>
                                    </div>
                                    <div className="rezept-vorlagen-chips">
                                        {vorlagenPreview.map(({ id, titel, n }) => (
                                            <button
                                                key={id}
                                                type="button"
                                                className="rezept-vorlage-chip"
                                                onClick={() => applyVorlage(id)}
                                                title={n === 0 ? t("page.rezepte.create.template_empty_title") : tp("page.rezepte.create.template_lines_title", { count: n })}
                                                disabled={n === 0}
                                            >
                                                <span className="rezept-vorlage-chip-title">{titel}</span>
                                                <span className="pill grey" style={{ fontSize: 10.5 }}>{n}×</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}>
                                    {t("page.rezepte.create.no_templates_lead")}{" "}
                                    <button type="button" className="linkish" onClick={() => navigate("/verwaltung/vorlagen")}>
                                        {t("page.rezepte.create.verwaltung_link")}
                                    </button>{" "}
                                    {t("page.rezepte.create.no_templates_tail")}
                                </p>
                            )}
                        </div>

                        <datalist id="rc-med-suggestions">
                            {MEDIKAMENT_SUGGESTIONS.map((s) => (
                                <option key={s.label} value={s.label} />
                            ))}
                        </datalist>

                        <div
                            style={{
                                border: "1px solid var(--line)",
                                borderRadius: 10,
                                padding: 12,
                                marginBottom: 12,
                                background: "rgba(0,0,0,0.02)",
                            }}
                        >
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t("page.rezepte.new_line")}</div>
                            {draftError ? (
                                <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 8px" }}>{draftError}</p>
                            ) : null}
                            <Input
                                id="rc-med"
                                label={t("page.rezepte.field.medication")}
                                list="rc-med-suggestions"
                                value={draft.medikament}
                                onChange={(e) => pickMed(e.target.value)}
                                placeholder={t("page.rezepte.field.medication_ph")}
                            />
                            <Input
                                id="rc-wirk"
                                label={t("page.rezepte.field.active_ingredient")}
                                value={draft.wirkstoff}
                                onChange={(e) => setDraft({ ...draft, wirkstoff: e.target.value })}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    id="rc-dos"
                                    label={t("page.rezepte.field.dosage")}
                                    value={draft.dosierung}
                                    onChange={(e) => setDraft({ ...draft, dosierung: e.target.value })}
                                    placeholder={t("page.rezepte.field.dosage_ph")}
                                />
                                <Input
                                    id="rc-dur"
                                    label={t("page.rezepte.field.duration")}
                                    value={draft.dauer}
                                    onChange={(e) => setDraft({ ...draft, dauer: e.target.value })}
                                    placeholder={t("page.rezepte.field.duration_ph")}
                                />
                            </div>
                            <Textarea
                                id="rc-hin"
                                label={t("page.rezepte.field.notes_line")}
                                rows={2}
                                value={draft.hinweise}
                                onChange={(e) => setDraft({ ...draft, hinweise: e.target.value })}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginTop: 8 }}>
                                <Input
                                    id="rc-pzn"
                                    label={t("page.rezepte.field.pzn")}
                                    value={draft.pzn}
                                    onChange={(e) => setDraft({ ...draft, pzn: e.target.value })}
                                />
                                <Select
                                    id="rc-dar"
                                    label={t("page.rezepte.field.darreichungsform")}
                                    value={draft.darreichungsform}
                                    options={[
                                        { value: "", label: "—" },
                                        ...DARREICHUNGSFORM_OPTIONS.map((d) => ({ value: d, label: d })),
                                    ]}
                                    onChange={(e) => setDraft({ ...draft, darreichungsform: e.target.value })}
                                />
                                <Select
                                    id="rc-pack"
                                    label={t("page.rezepte.field.packungsgroesse")}
                                    value={draft.packungsgroesse}
                                    options={[
                                        { value: "", label: "—" },
                                        ...PACKUNGSGROESSE_OPTIONS.map((p) => ({ value: p, label: p })),
                                    ]}
                                    onChange={(e) => setDraft({ ...draft, packungsgroesse: e.target.value })}
                                />
                                <Input
                                    id="rc-menge"
                                    label={t("page.rezepte.field.menge")}
                                    type="number"
                                    min={1}
                                    value={draft.menge}
                                    onChange={(e) => setDraft({ ...draft, menge: e.target.value })}
                                />
                                <Select
                                    id="rc-typ"
                                    label={t("page.rezepte.field.rezepttyp")}
                                    value={draft.rezept_typ}
                                    options={REZEPT_TYP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            rezept_typ: e.target.value as RezeptLine["rezept_typ"],
                                        })
                                    }
                                />
                                <Input
                                    id="rc-icd"
                                    label={t("page.rezepte.field.icd10")}
                                    list="rc-icd-suggestions"
                                    value={draft.icd10_code}
                                    onChange={(e) => setDraft({ ...draft, icd10_code: e.target.value })}
                                />
                            </div>
                            <datalist id="rc-icd-suggestions">
                                {DENTAL_ICD10_SUGGESTIONS.map((c) => (
                                    <option key={c} value={c} />
                                ))}
                            </datalist>
                            <label className="row" style={{ gap: 8, alignItems: "center", marginTop: 8, fontSize: 13 }}>
                                <input
                                    type="checkbox"
                                    checked={draft.aut_idem}
                                    onChange={(e) => setDraft({ ...draft, aut_idem: e.target.checked })}
                                />
                                {t("page.rezepte.field.aut_idem")}
                            </label>
                            <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                                <Button type="button" size="sm" variant="secondary" onClick={addLine}>
                                    {t("page.rezepte.create.add_line_btn")}
                                </Button>
                            </div>
                        </div>

                        <Textarea
                            id="rc-shared"
                            label={t("page.rezepte.shared_notes")}
                            rows={2}
                            value={shared}
                            onChange={(e) => setShared(e.target.value)}
                        />

                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                                {tp("page.rezepte.lines_title", { count: lines.length })}
                            </div>
                            {lines.length === 0 ? (
                                <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0 }}>
                                    {t("page.rezepte.create.lines_empty_hint")}
                                </p>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table className="tbl">
                                        <thead>
                                            <tr>
                                                <th>{t("page.rezepte.col.medication")}</th>
                                                <th>{t("page.rezepte.col.dosage")}</th>
                                                <th>{t("page.rezepte.col.duration")}</th>
                                                <th style={{ width: 100 }} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lines.map((ln, i) => (
                                                <tr key={`${ln.medikament}-${i}`}>
                                                    <td style={{ fontWeight: 600 }}>{ln.medikament}</td>
                                                    <td>{ln.dosierung}</td>
                                                    <td>{ln.dauer}</td>
                                                    <td>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i)}>
                                                            {t("common.remove")}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                            <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>
                                {t("page.rezepte.create.after_save_hint")}
                            </p>
                            <div className="row" style={{ gap: 8 }}>
                                <Button variant="ghost" onClick={() => navigate(`/patienten/${patientId}#rezept`)} disabled={creating}>
                                    {t("common.cancel")}
                                </Button>
                                <Button onClick={() => void handleSave()} loading={creating} disabled={cannotSave}>
                                    {creating
                                        ? t("page.rezepte.saving")
                                        : nLines > 1
                                            ? tp("page.rezepte.create_many", { count: nLines })
                                            : t("page.rezepte.create_one")}
                                </Button>
                            </div>
                        </div>
                    </div>
            </Card>
            </div>
        </div>
    );
}
