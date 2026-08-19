import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import { listDocumentTemplates } from "@/systems/practice-host/controllers/practice.controller";
import { createPrescription } from "@/systems/practice-host/controllers/prescription.controller";
import { errorMessage } from "@/lib/utils";
import { useLocale, useT, useTParams } from "@/lib/i18n";
import type { DocumentTemplate } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/administration-page-header";
import {
    MEDICATION_SUGGESTIONS,
    DOSAGE_FORM_OPTIONS,
    PACK_SIZE_OPTIONS,
    PRESCRIPTION_KIND_OPTIONS,
    DENTAL_ICD10_SUGGESTIONS,
    findSuggestion as findMedSuggestion,
    emptyPrescriptionLine,
    parsePrescriptionTemplatePayload,
    templateItemsToLines,
    type PrescriptionLine,
} from "@/lib/medications";
import type { Patient } from "../../models/types";

function validatePrescriptionLine(line: PrescriptionLine, t: (key: string) => string): string | null {
    if (!line.medication.trim()) return t("page.prescriptions.validation.med_required");
    if (!line.dosage.trim()) return t("page.prescriptions.validation.dosage_required");
    if (!line.duration.trim()) return t("page.prescriptions.validation.duration_required");
    return null;
}

export function PrescriptionCreatePage() {
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

    const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
    const [templateSelect, setTemplateSelect] = useState("");

    const [draft, setDraft] = useState<PrescriptionLine>(emptyPrescriptionLine);
    const [draftError, setDraftError] = useState<string | null>(null);
    const [lines, setLines] = useState<PrescriptionLine[]>([]);
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
        void listDocumentTemplates()
            .then((all) => {
                if (cancelled) return;
                setTemplates(all.filter((version) => version.kind === "PRESCRIPTION"));
            })
            .catch(() => {
                if (!cancelled) setTemplates([]);
            });
        return () => { cancelled = true; };
    }, []);

    const applyTemplate = useCallback(
        (templateId: string) => {
            if (!templateId) return;
            const version = templates.find((x) => x.id === templateId);
            if (!version) return;
            const items = parsePrescriptionTemplatePayload(version.payload);
            const newLines = templateItemsToLines(items);
            if (newLines.length === 0) {
                toast(t("page.prescriptions.toast.template_no_meds"), "error");
                return;
            }
            setTemplateSelect(templateId);
            setLines((prev) => [...prev, ...newLines]);
            setDraftError(null);
            const suffix = newLines.length === 1 ? "" : locale === "de" ? "n" : "s";
            toast(tp("page.prescriptions.toast.template_applied", { title: version.title, count: newLines.length, suffix }));
        },
        [templates, toast, t, tp, locale],
    );

    useEffect(() => {
        const q = searchParams.get("template");
        if (!q || templates.length === 0) return;
        const exists = templates.some((version) => version.id === q);
        if (!exists) return;
        applyTemplate(q);
        navigate({ search: "" }, { replace: true });
    }, [searchParams, templates, applyTemplate, navigate]);

    const templateOptions = useMemo(
        () => [{ value: "", label: t("page.prescriptions.template_choose") }, ...templates.map((version) => ({ value: version.id, label: version.title }))],
        [templates, t],
    );

    const templatesPreview = useMemo(
        () =>
            templates.map((version) => {
                const n = parsePrescriptionTemplatePayload(version.payload).filter(
                    (it) => it && typeof it.medication === "string" && it.medication.trim().length > 0,
                ).length;
                return { id: version.id, title: version.title, n };
            }),
        [templates],
    );

    const pickMed = (label: string) => {
        const sugg = findMedSuggestion(label);
        setDraft((prev) => ({
            ...prev,
            medication: label,
            active_ingredient: prev.active_ingredient || sugg?.active_ingredient || "",
            dosage: prev.dosage || sugg?.dosage || "",
        }));
    };

    const addLine = () => {
        const err = validatePrescriptionLine(draft, t);
        if (err) {
            setDraftError(err);
            return;
        }
        setLines((prev) => [...prev, { ...draft }]);
        setDraft(emptyPrescriptionLine());
        setDraftError(null);
    };

    const removeLine = (idx: number) => {
        setLines((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (!patientId || !session) return;
        const queue: PrescriptionLine[] = [...lines];
        if (validatePrescriptionLine(draft, t) === null) queue.push({ ...draft });
        if (queue.length === 0) {
            setDraftError(t("page.prescriptions.validation.min_one_line"));
            return;
        }
        setCreating(true);
        setError(null);
        let ok = 0;
        try {
            for (const line of queue) {
                const merged = [line.instructions, shared].filter((s) => s.trim()).join(" · ");
                const quantityN = Number.parseInt(line.quantity.trim(), 10);
                await createPrescription({
                    patient_id: patientId,
                    physician_id: session.user_id,
                    medication: line.medication.trim(),
                    active_ingredient: line.active_ingredient.trim() || null,
                    dosage: line.dosage.trim(),
                    duration: line.duration.trim(),
                    instructions: merged.trim() || null,
                    pzn: line.pzn.trim() || null,
                    dosage_form: line.dosage_form.trim() || null,
                    pack_size: line.pack_size.trim() || null,
                    quantity: Number.isFinite(quantityN) && quantityN > 0 ? quantityN : null,
                    aut_idem: line.aut_idem,
                    prescription_type: line.prescription_type,
                    icd10_code: line.icd10_code.trim() || null,
                    prescribing_physician_id: session.user_id,
                });
                ok += 1;
            }
            toast(
                ok === 1 ? t("page.prescriptions.toast.created_one") : tp("page.prescriptions.toast.created_many", { count: ok }),
                "success",
            );
            navigate(`/patients/${patientId}#prescription`);
        } catch (e) {
            setError(
                ok > 0
                    ? tp("page.prescriptions.toast.create_partial", { created: ok, message: errorMessage(e) })
                    : errorMessage(e),
            );
        } finally {
            setCreating(false);
        }
    };

    if (!patientId) {
        return (
            <div className="animate-fade-in p-4">
                <p className="text-body text-on-surface-variant">{t("page.prescriptions.create.no_patient")}</p>
            </div>
        );
    }

    if (loadingPatient) return <PageLoading label={t("page.prescriptions.loading_patients")} />;
    if (loadError || !patient) {
        return <PageLoadError message={loadError ?? t("page.prescriptions.toast.linked_patient_not_found")} onRetry={() => void loadPatient()} />;
    }

    const nLines = lines.length + (validatePrescriptionLine(draft, t) === null ? 1 : 0);
    const cannotSave = nLines === 0 || creating;

    return (
        <div className="practice-workspace-page animate-fade-in">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.prescriptions.create.page_title")}
                eyebrow={patient.name}
                back={{ to: `/patients/${patientId}#prescription`, label: t("patient.detail.title") }}
            />

            <div style={{ maxWidth: 920 }}>
            <Card>
                    <CardHeader
                        title={t("page.prescriptions.create.combo_title")}
                        subtitle={t("page.prescriptions.create.combo_subtitle")}
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

                        <div className="prescription-templates-panel">
                            <div className="form-overline">
                                {t("page.prescriptions.create.templates_section")}
                            </div>
                            {templates.length > 0 ? (
                                <>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end" style={{ marginBottom: 10 }}>
                                        <div className="flex-1 min-w-0">
                                            <Select
                                                id="rc-template"
                                                label={t("page.prescriptions.create.template_label")}
                                                value={templateSelect}
                                                options={templateOptions}
                                                onChange={(e) => setTemplateSelect(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={!templateSelect}
                                            onClick={() => applyTemplate(templateSelect)}
                                        >
                                            {t("page.prescriptions.create.insert_btn")}
                                        </Button>
                                    </div>
                                    <div className="prescription-templates-chips">
                                        {templatesPreview.map(({ id, title, n }) => (
                                            <button
                                                key={id}
                                                type="button"
                                                className="prescription-template-chip"
                                                onClick={() => applyTemplate(id)}
                                                title={n === 0 ? t("page.prescriptions.create.template_empty_title") : tp("page.prescriptions.create.template_lines_title", { count: n })}
                                                disabled={n === 0}
                                            >
                                                <span className="prescription-template-chip-title">{title}</span>
                                                <span className="pill grey" style={{ fontSize: 10.5 }}>{n}×</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}>
                                    {t("page.prescriptions.create.no_templates_lead")}{" "}
                                    <button type="button" className="linkish" onClick={() => navigate("/administration/templates")}>
                                        {t("page.prescriptions.create.administration_link")}
                                    </button>{" "}
                                    {t("page.prescriptions.create.no_templates_tail")}
                                </p>
                            )}
                        </div>

                        <datalist id="rc-med-suggestions">
                            {MEDICATION_SUGGESTIONS.map((s) => (
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
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{t("page.prescriptions.new_line")}</div>
                            {draftError ? (
                                <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 8px" }}>{draftError}</p>
                            ) : null}
                            <Input
                                id="rc-med"
                                label={t("page.prescriptions.field.medication")}
                                list="rc-med-suggestions"
                                value={draft.medication}
                                onChange={(e) => pickMed(e.target.value)}
                                placeholder={t("page.prescriptions.field.medication_ph")}
                            />
                            <Input
                                id="rc-wirk"
                                label={t("page.prescriptions.field.active_ingredient")}
                                value={draft.active_ingredient}
                                onChange={(e) => setDraft({ ...draft, active_ingredient: e.target.value })}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    id="rc-dos"
                                    label={t("page.prescriptions.field.dosage")}
                                    value={draft.dosage}
                                    onChange={(e) => setDraft({ ...draft, dosage: e.target.value })}
                                    placeholder={t("page.prescriptions.field.dosage_ph")}
                                />
                                <Input
                                    id="rc-dur"
                                    label={t("page.prescriptions.field.duration")}
                                    value={draft.duration}
                                    onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                                    placeholder={t("page.prescriptions.field.duration_ph")}
                                />
                            </div>
                            <Textarea
                                id="rc-hin"
                                label={t("page.prescriptions.field.notes_line")}
                                rows={2}
                                value={draft.instructions}
                                onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginTop: 8 }}>
                                <Input
                                    id="rc-pzn"
                                    label={t("page.prescriptions.field.pzn")}
                                    value={draft.pzn}
                                    onChange={(e) => setDraft({ ...draft, pzn: e.target.value })}
                                />
                                <Select
                                    id="rc-dar"
                                    label={t("page.prescriptions.field.dosage_form")}
                                    value={draft.dosage_form}
                                    options={[
                                        { value: "", label: "—" },
                                        ...DOSAGE_FORM_OPTIONS.map((d) => ({ value: d, label: d })),
                                    ]}
                                    onChange={(e) => setDraft({ ...draft, dosage_form: e.target.value })}
                                />
                                <Select
                                    id="rc-pack"
                                    label={t("page.prescriptions.field.pack_size")}
                                    value={draft.pack_size}
                                    options={[
                                        { value: "", label: "—" },
                                        ...PACK_SIZE_OPTIONS.map((p) => ({ value: p, label: p })),
                                    ]}
                                    onChange={(e) => setDraft({ ...draft, pack_size: e.target.value })}
                                />
                                <Input
                                    id="rc-quantity"
                                    label={t("page.prescriptions.field.quantity")}
                                    type="number"
                                    min={1}
                                    value={draft.quantity}
                                    onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
                                />
                                <Select
                                    id="rc-kind"
                                    label={t("page.prescriptions.field.prescription_kind")}
                                    value={draft.prescription_type}
                                    options={PRESCRIPTION_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            prescription_type: e.target.value as PrescriptionLine["prescription_type"],
                                        })
                                    }
                                />
                                <Input
                                    id="rc-icd"
                                    label={t("page.prescriptions.field.icd10")}
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
                                {t("page.prescriptions.field.aut_idem")}
                            </label>
                            <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                                <Button type="button" size="sm" variant="secondary" onClick={addLine}>
                                    {t("page.prescriptions.create.add_line_btn")}
                                </Button>
                            </div>
                        </div>

                        <Textarea
                            id="rc-shared"
                            label={t("page.prescriptions.shared_notes")}
                            rows={2}
                            value={shared}
                            onChange={(e) => setShared(e.target.value)}
                        />

                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                                {tp("page.prescriptions.lines_title", { count: lines.length })}
                            </div>
                            {lines.length === 0 ? (
                                <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0 }}>
                                    {t("page.prescriptions.create.lines_empty_hint")}
                                </p>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table className="tbl">
                                        <thead>
                                            <tr>
                                                <th>{t("page.prescriptions.col.medication")}</th>
                                                <th>{t("page.prescriptions.col.dosage")}</th>
                                                <th>{t("page.prescriptions.col.duration")}</th>
                                                <th style={{ width: 100 }} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lines.map((ln, i) => (
                                                <tr key={`${ln.medication}-${i}`}>
                                                    <td style={{ fontWeight: 600 }}>{ln.medication}</td>
                                                    <td>{ln.dosage}</td>
                                                    <td>{ln.duration}</td>
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
                                {t("page.prescriptions.create.after_save_hint")}
                            </p>
                            <div className="row" style={{ gap: 8 }}>
                                <Button variant="ghost" onClick={() => navigate(`/patients/${patientId}#prescription`)} disabled={creating}>
                                    {t("common.cancel")}
                                </Button>
                                <Button onClick={() => void handleSave()} loading={creating} disabled={cannotSave}>
                                    {creating
                                        ? t("page.prescriptions.saving")
                                        : nLines > 1
                                            ? tp("page.prescriptions.create_many", { count: nLines })
                                            : t("page.prescriptions.create_one")}
                                </Button>
                            </div>
                        </div>
                    </div>
            </Card>
            </div>
        </div>
    );
}
