import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Textarea, Select } from "../components/ui/input";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { useAuthStore } from "../../models/store/auth-store";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import {
    listPrescriptions,
    createPrescription,
    deletePrescription,
    type Prescription,
} from "@/systems/practice-host/controllers/prescription.controller";
import { validateEprescription, submitEprescription } from "@/systems/practice-host/controllers/integration.controller";
import { localCapability } from "@/lib/integration-capabilities";
import { listDocumentTemplates } from "@/systems/practice-host/controllers/practice.controller";
import type { Patient, DocumentTemplate } from "../../models/types";
import { errorMessage, formatDate } from "@/lib/utils";
import { useT, useTParams } from "@/lib/i18n";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { HtmlDocumentExportPickerDialog } from "../components/export-picker-dialog";
import {
    bundlePrescriptionExport,
    bundlePrescriptionsComboExport,
    suggestPrescriptionComboExportBasename,
    suggestPrescriptionExportBasename,
    type ClinicalDocumentExportBundle,
} from "@/lib/document-print-html";
import { PackageIcon, SearchIcon } from "@/lib/icons";
import {
    MEDICATION_SUGGESTIONS,
    findSuggestion,
    emptyPrescriptionLine,
    parsePrescriptionTemplatePayload,
    templateItemsToLines,
    type PrescriptionLine,
} from "@/lib/medications";

/**
 * Rezeptverwaltung (FA-REZ-01..05).
 * Export via structured template (format, path from export settings).
 */
export function PrescriptionsPage() {
    const t = useT();
    const tp = useTParams();
    const session = useAuthStore((s) => s.session);
    const eprescriptionLive = localCapability("eprescription")?.available ?? false;
    const toast = useToastStore((s) => s.add);
    const [searchParams, setSearchParams] = useSearchParams();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [patientsError, setPatientsError] = useState<string | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<string>("");
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [draft, setDraft] = useState<PrescriptionLine>(emptyPrescriptionLine);
    const [draftError, setDraftError] = useState<string | null>(null);
    const [lines, setLines] = useState<PrescriptionLine[]>([]);
    const [sharedInstructions, setSharedInstructions] = useState("");
    const [creating, setCreating] = useState(false);
    const [medFilter, setMedFilter] = useState("");
    const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
    const [templateId, setTemplateId] = useState("");
    const [htmlExport, setHtmlExport] = useState<{
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
    } | null>(null);

    const loadPatients = useCallback(async () => {
        setPatientsLoading(true);
        setPatientsError(null);
        try {
            const ps = await listPatients();
            setPatients(ps);
            setSelectedPatient((prev) => prev || (ps[0]?.id ?? ""));
        } catch (e) {
            setPatientsError(errorMessage(e));
            setPatients([]);
            setSelectedPatient("");
        } finally {
            setPatientsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPatients();
    }, [loadPatients]);

    useEffect(() => {
        const pid = searchParams.get("patient_id");
        if (!pid || patients.length === 0) return;
        const exists = patients.some((p) => p.id === pid);
        if (exists) {
            setSelectedPatient(pid);
        } else {
            toast(t("page.prescriptions.toast.linked_patient_not_found"), "error");
        }
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("patient_id");
            return next;
        }, { replace: true });
    }, [patients, searchParams, setSearchParams, toast, t]);

    const fetchPrescriptions = useCallback(async () => {
        if (!selectedPatient) {
            setPrescriptions([]);
            setListError(null);
            setListLoading(false);
            return;
        }
        setListLoading(true);
        setListError(null);
        try {
            setPrescriptions(await listPrescriptions(selectedPatient));
        } catch (e) {
            setListError(errorMessage(e));
            setPrescriptions([]);
        } finally {
            setListLoading(false);
        }
    }, [selectedPatient]);

    useEffect(() => {
        void fetchPrescriptions();
    }, [fetchPrescriptions]);

    function resetCreateForm() {
        setDraft(emptyPrescriptionLine());
        setDraftError(null);
        setLines([]);
        setSharedInstructions("");
        setTemplateId("");
    }

    useEffect(() => {
        if (!showCreate || templates.length > 0) return;
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
    }, [showCreate, templates.length]);

    function applyTemplate(id: string) {
        setTemplateId(id);
        if (!id) return;
        const version = templates.find((x) => x.id === id);
        if (!version) return;
        const items = parsePrescriptionTemplatePayload(version.payload);
        const newLines = templateItemsToLines(items);
        if (newLines.length === 0) {
            toast(t("page.prescriptions.toast.template_no_meds"), "error");
            return;
        }
        setLines((prev) => [...prev, ...newLines]);
        setDraftError(null);
        toast(tp("page.prescriptions.toast.template_applied", {
            title: version.title,
            count: newLines.length,
            suffix: newLines.length === 1 ? "" : "n",
        }));
    }

    function pickMedication(label: string) {
        const sugg = findSuggestion(label);
        setDraft((prev) => ({
            ...prev,
            medication: label,
            active_ingredient: prev.active_ingredient || sugg?.active_ingredient || "",
            dosage: prev.dosage || sugg?.dosage || "",
        }));
    }

    function validateLine(line: PrescriptionLine): string | null {
        if (!line.medication.trim()) return t("page.prescriptions.validation.med_required");
        if (!line.dosage.trim()) return t("page.prescriptions.validation.dosage_required");
        if (!line.duration.trim()) return t("page.prescriptions.validation.duration_required");
        return null;
    }

    function handleAddLine() {
        const err = validateLine(draft);
        if (err) {
            setDraftError(err);
            return;
        }
        setLines((prev) => [...prev, { ...draft }]);
        setDraft(emptyPrescriptionLine());
        setDraftError(null);
    }

    function removeLine(idx: number) {
        setLines((prev) => prev.filter((_, i) => i !== idx));
    }

    async function handleCreate() {
        if (!selectedPatient || !session) return;
        const queue: PrescriptionLine[] = [...lines];
        if (validateLine(draft) === null) {
            queue.push({ ...draft });
        }
        if (queue.length === 0) {
            setDraftError(t("page.prescriptions.validation.min_one_line"));
            return;
        }
        setCreating(true);
        let okCount = 0;
        const created: Prescription[] = [];
        try {
            for (const line of queue) {
                const merged = [line.instructions, sharedInstructions].filter((s) => s.trim()).join(" · ");
                const r = await createPrescription({
                    patient_id: selectedPatient,
                    physician_id: session.user_id,
                    medication: line.medication.trim(),
                    active_ingredient: line.active_ingredient.trim() || null,
                    dosage: line.dosage.trim(),
                    duration: line.duration.trim(),
                    instructions: merged.trim() || null,
                });
                created.push(r);
                okCount += 1;
            }
            toast(okCount === 1 ? t("page.prescriptions.toast.created_one") : tp("page.prescriptions.toast.created_many", { count: okCount }));
            setShowCreate(false);
            resetCreateForm();
            await fetchPrescriptions();
            if (created.length > 1) {
                printCombo(created);
            }
        } catch (e) {
            toast(okCount > 0
                ? tp("page.prescriptions.toast.create_partial", { created: okCount, message: errorMessage(e) })
                : `${t("common.error_prefix")} ${errorMessage(e)}`, "error");
            await fetchPrescriptions();
        } finally {
            setCreating(false);
        }
    }

    const filteredPrescriptions = useMemo(() => {
        const q = medFilter.trim().toLowerCase();
        if (!q) return prescriptions;
        return prescriptions.filter(
            (r) =>
                r.medication.toLowerCase().includes(q)
                || (r.active_ingredient?.toLowerCase().includes(q) ?? false),
        );
    }, [prescriptions, medFilter]);

    const [kpi, setKpi] = useState({ weekCount: 0, pending: 0, pct: 0 });
    useEffect(() => {
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        let weekCount = 0;
        for (const r of prescriptions) {
            const t = new Date(r.issued_at).getTime();
            if (!Number.isNaN(t) && now - t <= weekMs) weekCount += 1;
        }
        const pending = prescriptions.filter((r) => r.status !== "ISSUED").length;
        const issued = prescriptions.filter((r) => r.status === "ISSUED").length;
        const pct = prescriptions.length === 0 ? 0 : Math.round((issued / prescriptions.length) * 100);
        setKpi({ weekCount, pending, pct });
    }, [prescriptions]);

    async function handleDelete() {
        if (!deleteId) return;
        try {
            await deletePrescription(deleteId);
            toast(t("page.prescriptions.toast.deleted"));
            setDeleteId(null);
            await fetchPrescriptions();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
        }
    }

    /* ─── e-Prescription (FA-INT, FA-REZ-08) ────────────────────────────────── */
    const [ePrescriptionTarget, setEPrescriptionTarget] = useState<Prescription | null>(null);
    const [eRez, setERez] = useState({ kvnr: "", pzn: "", lanr: "", quantity: "1" });
    const [eRezBusy, setERezBusy] = useState(false);

    function openEPrescriptionDialog(r: Prescription) {
        setEPrescriptionTarget(r);
        // Prefill best-guesses; user must confirm KVNR/LANR before submission.
        setERez({ kvnr: "", pzn: "", lanr: "", quantity: "1" });
    }

    async function handleValidateEPrescription() {
        if (!ePrescriptionTarget) return;
        setERezBusy(true);
        try {
            await validateEprescription({
                patient_id: ePrescriptionTarget.patient_id,
                kvnr: eRez.kvnr.trim().toUpperCase(),
                pzn: eRez.pzn.trim(),
                medication_name: ePrescriptionTarget.medication,
                dosage: ePrescriptionTarget.dosage,
                quantity: Number(eRez.quantity) || 1,
                doctor_lanr: eRez.lanr.trim(),
                issued_at: ePrescriptionTarget.issued_at.slice(0, 10),
            });
            toast(t("page.prescriptions.toast.eprescription_valid"), "success");
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
        } finally {
            setERezBusy(false);
        }
    }

    async function handleSubmitEPrescription() {
        if (!ePrescriptionTarget || !eprescriptionLive) return;
        setERezBusy(true);
        try {
            const token = await submitEprescription({
                patient_id: ePrescriptionTarget.patient_id,
                kvnr: eRez.kvnr.trim().toUpperCase(),
                pzn: eRez.pzn.trim(),
                medication_name: ePrescriptionTarget.medication,
                dosage: ePrescriptionTarget.dosage,
                quantity: Number(eRez.quantity) || 1,
                doctor_lanr: eRez.lanr.trim(),
                issued_at: ePrescriptionTarget.issued_at.slice(0, 10),
            });
            toast(tp("page.prescriptions.toast.ti_sent", { taskId: token.task_id }), "success");
            setEPrescriptionTarget(null);
        } catch (e) {
            // Backend currently returns "TI-Konnektor required" — surface verbatim.
            toast(tp("page.prescriptions.toast.ti_submit", { message: errorMessage(e) }), "info");
        } finally {
            setERezBusy(false);
        }
    }

    function openPrescriptionExport(items: Prescription[]) {
        if (items.length === 0) return;
        const first = items[0]!;
        const patient = patients.find((p) => p.id === first.patient_id) ?? null;
        const bundle =
            items.length === 1 ? bundlePrescriptionExport(first, patient) : bundlePrescriptionsComboExport(items, patient);
        const suggestedBasename =
            items.length === 1 ? suggestPrescriptionExportBasename(first) : suggestPrescriptionComboExportBasename(items);
        const pname = patient?.name ?? "";
        const exportPreviewTitle =
            items.length === 1
                ? tp("page.prescriptions.export_single", { name: pname })
                : tp("page.prescriptions.export_combo", { count: items.length, name: pname });
        setHtmlExport({ bundle, suggestedBasename, exportPreviewTitle });
    }

    function handlePrint(r: Prescription) {
        openPrescriptionExport([r]);
    }

    function printCombo(items: Prescription[]) {
        openPrescriptionExport(items);
    }

    return (
        <div className="practice-workspace-page animate-fade-in">
            <WorkspacePageHeader
                title={t("page.prescriptions.title")}
                subtitle={tp("page.prescriptions.subtitle", {
                    filtered: filteredPrescriptions.length,
                    total: prescriptions.length,
                })}
                actions={
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <div className="input" style={{ width: "min(220px, 100%)", flex: "1 1 220px" }}>
                            <input
                                placeholder={t("page.prescriptions.filter_placeholder")}
                                value={medFilter}
                                onChange={(e) => setMedFilter(e.target.value)}
                                aria-label={t("page.prescriptions.filter_aria")}
                            />
                        </div>
                        {medFilter ? (
                            <Button variant="ghost" onClick={() => setMedFilter("")}>{t("page.prescriptions.filter_clear")}</Button>
                        ) : null}
                        <Button onClick={() => setShowCreate(true)} disabled={!selectedPatient}>{t("page.prescriptions.new")}</Button>
                    </div>
                }
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                <div className="card kpi"><div className="kpi-label">{t("page.prescriptions.kpi.issued_7d")}</div><div className="kpi-val">{kpi.weekCount}</div></div>
                <div className="card kpi"><div className="kpi-label">{t("page.prescriptions.kpi.pending")}</div><div className="kpi-val">{kpi.pending}</div></div>
                <div className="card kpi"><div className="kpi-label">{t("page.prescriptions.kpi.issued_pct")}</div><div className="kpi-val">{kpi.pct}%</div></div>
            </div>

            <Card className="card-pad">
                <CardHeader title={t("page.prescriptions.select_patient")} />
                {patientsLoading ? (
                    <p className="text-body text-on-surface-variant" role="status">{t("page.prescriptions.loading_patients")}</p>
                ) : patientsError ? (
                    <PageLoadError message={patientsError} onRetry={() => void loadPatients()} />
                ) : (
                    <Select
                        id="rez-patient"
                        value={selectedPatient}
                        onChange={(e) => setSelectedPatient(e.target.value)}
                        disabled={patients.length === 0}
                        options={[
                            ...(patients.length === 0
                                ? [{ value: "", label: t("page.prescriptions.no_patients") }]
                                : [{ value: "", label: t("page.prescriptions.choose_patient") }]),
                            ...patients.map((p) => ({ value: p.id, label: p.name })),
                        ]}
                    />
                )}
            </Card>

            {patientsLoading || patientsError ? null : !selectedPatient ? (
                <p className="text-body text-on-surface-variant">{t("page.prescriptions.select_patient_hint")}</p>
            ) : listLoading ? (
                <PageLoading label={t("page.prescriptions.loading")} />
            ) : listError ? (
                <PageLoadError message={listError} onRetry={() => void fetchPrescriptions()} />
            ) : prescriptions.length === 0 ? (
                <EmptyState graphic={<PackageIcon size={40} />} title={t("page.prescriptions.empty")} />
            ) : filteredPrescriptions.length === 0 ? (
                <EmptyState
                    graphic={<SearchIcon size={40} />}
                    title={t("page.prescriptions.no_filter_results")}
                    description={t("page.prescriptions.no_filter_results_desc")}
                />
            ) : (
                <div className="card tbl-data-card">
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("page.prescriptions.col.medication")}</th><th>{t("page.prescriptions.col.pzn")}</th><th>{t("page.prescriptions.col.type")}</th><th>{t("page.prescriptions.col.dosage")}</th><th>{t("page.prescriptions.col.duration")}</th><th>{t("page.prescriptions.col.date")}</th><th>{t("page.prescriptions.col.status")}</th><th>{t("page.prescriptions.col.actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPrescriptions.map((r) => (
                                <tr key={r.id}>
                                    <td>{r.medication}</td>
                                    <td>{r.pzn?.trim() || "—"}</td>
                                    <td>{r.prescription_type?.trim() || "—"}</td>
                                    <td>{r.dosage}</td>
                                    <td>{r.duration}</td>
                                    <td>{formatDate(r.issued_at)}</td>
                                    <td>{r.status}</td>
                                    <td className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                        <Button size="sm" onClick={() => handlePrint(r)}>{t("page.prescriptions.export")}</Button>
                                        {eprescriptionLive ? (
                                            <Button size="sm" variant="ghost" onClick={() => openEPrescriptionDialog(r)}>{t("page.prescriptions.eprescription")}</Button>
                                        ) : null}
                                        <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>{t("common.delete")}</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}

            <Dialog
                open={showCreate}
                onClose={() => { if (!creating) { setShowCreate(false); resetCreateForm(); } }}
                title={t("page.prescriptions.create_title")}
                footer={<>
                    <Button variant="ghost" onClick={() => { setShowCreate(false); resetCreateForm(); }} disabled={creating}>{t("common.cancel")}</Button>
                    <Button
                        onClick={() => void handleCreate()}
                        disabled={creating || (lines.length === 0 && validateLine(draft) !== null)}
                    >
                        {creating
                            ? t("page.prescriptions.saving")
                            : lines.length + (validateLine(draft) === null ? 1 : 0) > 1
                                ? tp("page.prescriptions.create_many", { count: lines.length + (validateLine(draft) === null ? 1 : 0) })
                                : t("page.prescriptions.create_one")}
                    </Button>
                </>}
            >
                <datalist id="rez-med-suggestions">
                    {MEDICATION_SUGGESTIONS.map((s) => (
                        <option key={s.label} value={s.label} />
                    ))}
                </datalist>

                <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 0, marginBottom: 8 }}>
                    {t("page.prescriptions.create_hint")}
                </p>

                {templates.length > 0 ? (
                    <div style={{ marginBottom: 12 }}>
                        <Select
                            id="rez-template"
                            label={t("page.prescriptions.template_select")}
                            value={templateId}
                            onChange={(e) => applyTemplate(e.target.value)}
                            options={[
                                { value: "", label: t("page.prescriptions.template_choose") },
                                ...templates.map((version) => ({ value: version.id, label: version.title })),
                            ]}
                        />
                        <p style={{ fontSize: 11, color: "var(--fg-3)", margin: "4px 0 0" }}>
                            {t("page.prescriptions.template_hint")}
                        </p>
                    </div>
                ) : null}

                <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t("page.prescriptions.new_line")}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Input
                            id="rez-med"
                            label={t("page.prescriptions.field.medication")}
                            list="rez-med-suggestions"
                            placeholder={t("page.prescriptions.field.medication_ph")}
                            value={draft.medication}
                            onChange={(e) => pickMedication(e.target.value)}
                            error={draftError && !draft.medication.trim() ? draftError : undefined}
                        />
                        <Input
                            id="rez-wirk"
                            label={t("page.prescriptions.field.active_ingredient")}
                            value={draft.active_ingredient}
                            onChange={(e) => setDraft({ ...draft, active_ingredient: e.target.value })}
                        />
                        <Input
                            id="rez-dos"
                            label={t("page.prescriptions.field.dosage")}
                            value={draft.dosage}
                            onChange={(e) => setDraft({ ...draft, dosage: e.target.value })}
                            placeholder={t("page.prescriptions.field.dosage_ph")}
                            error={draftError && !draft.dosage.trim() ? draftError : undefined}
                        />
                        <Input
                            id="rez-dau"
                            label={t("page.prescriptions.field.duration")}
                            value={draft.duration}
                            onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                            placeholder={t("page.prescriptions.field.duration_ph")}
                            error={draftError && !draft.duration.trim() ? draftError : undefined}
                        />
                    </div>
                    <Textarea
                        id="rez-hin"
                        label={t("page.prescriptions.field.notes_line")}
                        value={draft.instructions}
                        onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
                        rows={2}
                    />
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                        <Button type="button" variant="secondary" onClick={handleAddLine} disabled={creating}>
                            {t("page.prescriptions.add_line")}
                        </Button>
                    </div>
                </div>

                <Textarea
                    id="rez-shared-instructions"
                    label={t("page.prescriptions.shared_notes")}
                    value={sharedInstructions}
                    onChange={(e) => setSharedInstructions(e.target.value)}
                    rows={2}
                />

                <div style={{ marginTop: 12, border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                        {tp("page.prescriptions.lines_title", { count: lines.length })}
                    </div>
                    {lines.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", fontSize: 13, margin: 0 }}>
                            {t("page.prescriptions.lines_empty")}
                        </p>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {lines.map((line, idx) => (
                                <li
                                    key={`${line.medication}-${idx}`}
                                    className="row"
                                    style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}
                                >
                                    <div style={{ fontSize: 13 }}>
                                        <strong>{line.medication}</strong>
                                        {line.active_ingredient ? ` (${line.active_ingredient})` : ""}
                                        {" — "}
                                        {line.dosage}
                                        {" · "}
                                        {line.duration}
                                        {line.instructions ? ` · ${line.instructions}` : ""}
                                    </div>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(idx)} disabled={creating}>
                                        {t("common.remove")}
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </Dialog>

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title={t("page.prescriptions.delete_title")}
                message={t("page.prescriptions.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />

            <Dialog
                open={!!ePrescriptionTarget}
                onClose={() => setEPrescriptionTarget(null)}
                title={tp("page.prescriptions.eprescription_title", { medication: ePrescriptionTarget?.medication ?? "" })}
                footer={<>
                    <Button variant="ghost" onClick={() => setEPrescriptionTarget(null)} disabled={eRezBusy}>{t("common.close")}</Button>
                    <Button variant="secondary" onClick={() => void handleValidateEPrescription()} disabled={eRezBusy} loading={eRezBusy}>{t("page.prescriptions.validate")}</Button>
                    {eprescriptionLive ? (
                        <Button onClick={() => void handleSubmitEPrescription()} disabled={eRezBusy} loading={eRezBusy}>{t("page.prescriptions.send_ti")}</Button>
                    ) : null}
                </>}
            >
                <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 0 8px" }}>
                    {t("page.prescriptions.eprescription_hint")}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Input id="er-kvnr" label={t("page.prescriptions.field.kvnr")} value={eRez.kvnr} onChange={(e) => setERez({ ...eRez, kvnr: e.target.value })} placeholder="A123456789" />
                    <Input id="er-pzn" label={t("page.prescriptions.field.pzn")} value={eRez.pzn} onChange={(e) => setERez({ ...eRez, pzn: e.target.value })} placeholder="12345678" />
                    <Input id="er-lanr" label={t("page.prescriptions.field.lanr")} value={eRez.lanr} onChange={(e) => setERez({ ...eRez, lanr: e.target.value })} placeholder="123456789" />
                    <Input id="er-qty" label={t("common.quantity")} type="number" value={eRez.quantity} onChange={(e) => setERez({ ...eRez, quantity: e.target.value })} />
                </div>
            </Dialog>
            {htmlExport ? (
                <HtmlDocumentExportPickerDialog
                    open
                    onClose={() => setHtmlExport(null)}
                    templateKind="prescription"
                    exportPreviewTitle={htmlExport.exportPreviewTitle}
                    suggestedBasename={htmlExport.suggestedBasename}
                    bundle={htmlExport.bundle}
                />
            ) : null}
        </div>
    );
}
