import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Textarea, Select } from "../components/ui/input";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { useAuthStore } from "../../models/store/auth-store";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import {
    listRezepte,
    createRezept,
    deleteRezept,
    type Rezept,
} from "@/systems/practice-host/controllers/rezept.controller";
import { validateEprescription, submitEprescription } from "@/systems/practice-host/controllers/integration.controller";
import { localCapability } from "@/lib/integration-capabilities";
import { listDokumentVorlagen } from "@/systems/practice-host/controllers/praxis.controller";
import type { Patient, DokumentVorlage } from "../../models/types";
import { errorMessage, formatDate } from "@/lib/utils";
import { useT, useTParams } from "@/lib/i18n";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { HtmlDocumentExportPickerDialog } from "../components/export-picker-dialog";
import {
    bundleRezeptExport,
    bundleRezepteComboExport,
    suggestRezeptComboExportBasename,
    suggestRezeptExportBasename,
    type ClinicalDocumentExportBundle,
} from "@/lib/document-print-html";
import { PackageIcon, SearchIcon } from "@/lib/icons";
import {
    MEDIKAMENT_SUGGESTIONS,
    findSuggestion,
    emptyRezeptLine,
    parseRezeptVorlagePayload,
    vorlageItemsToLines,
    type RezeptLine,
} from "@/lib/medikamente";

/**
 * Rezeptverwaltung (FA-REZ-01..05).
 * Export via structured template (format, path from export settings).
 */
export function RezeptePage() {
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
    const [rezepte, setRezepte] = useState<Rezept[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [draft, setDraft] = useState<RezeptLine>(emptyRezeptLine);
    const [draftError, setDraftError] = useState<string | null>(null);
    const [lines, setLines] = useState<RezeptLine[]>([]);
    const [sharedHinweise, setSharedHinweise] = useState("");
    const [creating, setCreating] = useState(false);
    const [medFilter, setMedFilter] = useState("");
    const [vorlagen, setVorlagen] = useState<DokumentVorlage[]>([]);
    const [vorlageId, setVorlageId] = useState("");
    const [htmlExport, setHtmlExport] = useState<{
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
    } | null>(null);

    const loadPatients = useCallback(async () => {
        setPatientsLoading(true);
        setPatientsError(null);
        try {
            const ps = await listPatienten();
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
            toast(t("page.rezepte.toast.linked_patient_not_found"), "error");
        }
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("patient_id");
            return next;
        }, { replace: true });
    }, [patients, searchParams, setSearchParams, toast, t]);

    const fetchRezepte = useCallback(async () => {
        if (!selectedPatient) {
            setRezepte([]);
            setListError(null);
            setListLoading(false);
            return;
        }
        setListLoading(true);
        setListError(null);
        try {
            setRezepte(await listRezepte(selectedPatient));
        } catch (e) {
            setListError(errorMessage(e));
            setRezepte([]);
        } finally {
            setListLoading(false);
        }
    }, [selectedPatient]);

    useEffect(() => {
        void fetchRezepte();
    }, [fetchRezepte]);

    function resetCreateForm() {
        setDraft(emptyRezeptLine());
        setDraftError(null);
        setLines([]);
        setSharedHinweise("");
        setVorlageId("");
    }

    useEffect(() => {
        if (!showCreate || vorlagen.length > 0) return;
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
    }, [showCreate, vorlagen.length]);

    function applyVorlage(id: string) {
        setVorlageId(id);
        if (!id) return;
        const v = vorlagen.find((x) => x.id === id);
        if (!v) return;
        const items = parseRezeptVorlagePayload(v.payload);
        const newLines = vorlageItemsToLines(items);
        if (newLines.length === 0) {
            toast(t("page.rezepte.toast.template_no_meds"), "error");
            return;
        }
        setLines((prev) => [...prev, ...newLines]);
        setDraftError(null);
        toast(tp("page.rezepte.toast.template_applied", {
            title: v.titel,
            count: newLines.length,
            suffix: newLines.length === 1 ? "" : "n",
        }));
    }

    function pickMedikament(label: string) {
        const sugg = findSuggestion(label);
        setDraft((prev) => ({
            ...prev,
            medikament: label,
            wirkstoff: prev.wirkstoff || sugg?.wirkstoff || "",
            dosierung: prev.dosierung || sugg?.dosierung || "",
        }));
    }

    function validateLine(line: RezeptLine): string | null {
        if (!line.medikament.trim()) return t("page.rezepte.validation.med_required");
        if (!line.dosierung.trim()) return t("page.rezepte.validation.dosage_required");
        if (!line.dauer.trim()) return t("page.rezepte.validation.duration_required");
        return null;
    }

    function handleAddLine() {
        const err = validateLine(draft);
        if (err) {
            setDraftError(err);
            return;
        }
        setLines((prev) => [...prev, { ...draft }]);
        setDraft(emptyRezeptLine());
        setDraftError(null);
    }

    function removeLine(idx: number) {
        setLines((prev) => prev.filter((_, i) => i !== idx));
    }

    async function handleCreate() {
        if (!selectedPatient || !session) return;
        const queue: RezeptLine[] = [...lines];
        if (validateLine(draft) === null) {
            queue.push({ ...draft });
        }
        if (queue.length === 0) {
            setDraftError(t("page.rezepte.validation.min_one_line"));
            return;
        }
        setCreating(true);
        let okCount = 0;
        const created: Rezept[] = [];
        try {
            for (const line of queue) {
                const merged = [line.hinweise, sharedHinweise].filter((s) => s.trim()).join(" · ");
                const r = await createRezept({
                    patient_id: selectedPatient,
                    arzt_id: session.user_id,
                    medikament: line.medikament.trim(),
                    wirkstoff: line.wirkstoff.trim() || null,
                    dosierung: line.dosierung.trim(),
                    dauer: line.dauer.trim(),
                    hinweise: merged.trim() || null,
                });
                created.push(r);
                okCount += 1;
            }
            toast(okCount === 1 ? t("page.rezepte.toast.created_one") : tp("page.rezepte.toast.created_many", { count: okCount }));
            setShowCreate(false);
            resetCreateForm();
            await fetchRezepte();
            if (created.length > 1) {
                printCombo(created);
            }
        } catch (e) {
            toast(okCount > 0
                ? tp("page.rezepte.toast.create_partial", { created: okCount, message: errorMessage(e) })
                : `${t("common.error_prefix")} ${errorMessage(e)}`, "error");
            await fetchRezepte();
        } finally {
            setCreating(false);
        }
    }

    const filteredRezepte = useMemo(() => {
        const q = medFilter.trim().toLowerCase();
        if (!q) return rezepte;
        return rezepte.filter(
            (r) =>
                r.medikament.toLowerCase().includes(q)
                || (r.wirkstoff?.toLowerCase().includes(q) ?? false),
        );
    }, [rezepte, medFilter]);

    const [kpi, setKpi] = useState({ weekCount: 0, pending: 0, pct: 0 });
    useEffect(() => {
        const now = Date.now();
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        let weekCount = 0;
        for (const r of rezepte) {
            const t = new Date(r.ausgestellt_am).getTime();
            if (!Number.isNaN(t) && now - t <= weekMs) weekCount += 1;
        }
        const pending = rezepte.filter((r) => r.status !== "AUSGESTELLT").length;
        const issued = rezepte.filter((r) => r.status === "AUSGESTELLT").length;
        const pct = rezepte.length === 0 ? 0 : Math.round((issued / rezepte.length) * 100);
        setKpi({ weekCount, pending, pct });
    }, [rezepte]);

    async function handleDelete() {
        if (!deleteId) return;
        try {
            await deleteRezept(deleteId);
            toast(t("page.rezepte.toast.deleted"));
            setDeleteId(null);
            await fetchRezepte();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
        }
    }

    /* ─── e-Rezept (FA-INT, FA-REZ-08) ────────────────────────────────── */
    const [eRezeptTarget, setERezeptTarget] = useState<Rezept | null>(null);
    const [eRez, setERez] = useState({ kvnr: "", pzn: "", lanr: "", quantity: "1" });
    const [eRezBusy, setERezBusy] = useState(false);

    function openERezeptDialog(r: Rezept) {
        setERezeptTarget(r);
        // Prefill best-guesses; user must confirm KVNR/LANR before submission.
        setERez({ kvnr: "", pzn: "", lanr: "", quantity: "1" });
    }

    async function handleValidateERezept() {
        if (!eRezeptTarget) return;
        setERezBusy(true);
        try {
            await validateEprescription({
                patient_id: eRezeptTarget.patient_id,
                kvnr: eRez.kvnr.trim().toUpperCase(),
                pzn: eRez.pzn.trim(),
                medication_name: eRezeptTarget.medikament,
                dosage: eRezeptTarget.dosierung,
                quantity: Number(eRez.quantity) || 1,
                doctor_lanr: eRez.lanr.trim(),
                issued_at: eRezeptTarget.ausgestellt_am.slice(0, 10),
            });
            toast(t("page.rezepte.toast.eprescription_valid"), "success");
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
        } finally {
            setERezBusy(false);
        }
    }

    async function handleSubmitERezept() {
        if (!eRezeptTarget || !eprescriptionLive) return;
        setERezBusy(true);
        try {
            const token = await submitEprescription({
                patient_id: eRezeptTarget.patient_id,
                kvnr: eRez.kvnr.trim().toUpperCase(),
                pzn: eRez.pzn.trim(),
                medication_name: eRezeptTarget.medikament,
                dosage: eRezeptTarget.dosierung,
                quantity: Number(eRez.quantity) || 1,
                doctor_lanr: eRez.lanr.trim(),
                issued_at: eRezeptTarget.ausgestellt_am.slice(0, 10),
            });
            toast(tp("page.rezepte.toast.ti_sent", { taskId: token.task_id }), "success");
            setERezeptTarget(null);
        } catch (e) {
            // Backend currently returns "TI-Konnektor erforderlich" — surface verbatim.
            toast(tp("page.rezepte.toast.ti_submit", { message: errorMessage(e) }), "info");
        } finally {
            setERezBusy(false);
        }
    }

    function openRezeptExport(items: Rezept[]) {
        if (items.length === 0) return;
        const first = items[0]!;
        const patient = patients.find((p) => p.id === first.patient_id) ?? null;
        const bundle =
            items.length === 1 ? bundleRezeptExport(first, patient) : bundleRezepteComboExport(items, patient);
        const suggestedBasename =
            items.length === 1 ? suggestRezeptExportBasename(first) : suggestRezeptComboExportBasename(items);
        const pname = patient?.name ?? "";
        const exportPreviewTitle =
            items.length === 1
                ? tp("page.rezepte.export_single", { name: pname })
                : tp("page.rezepte.export_combo", { count: items.length, name: pname });
        setHtmlExport({ bundle, suggestedBasename, exportPreviewTitle });
    }

    function handlePrint(r: Rezept) {
        openRezeptExport([r]);
    }

    function printCombo(items: Rezept[]) {
        openRezeptExport(items);
    }

    return (
        <div className="praxis-workspace-page animate-fade-in">
            <WorkspacePageHeader
                title={t("page.rezepte.title")}
                subtitle={tp("page.rezepte.subtitle", {
                    filtered: filteredRezepte.length,
                    total: rezepte.length,
                })}
                actions={
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <div className="input" style={{ width: "min(220px, 100%)", flex: "1 1 220px" }}>
                            <input
                                placeholder={t("page.rezepte.filter_placeholder")}
                                value={medFilter}
                                onChange={(e) => setMedFilter(e.target.value)}
                                aria-label={t("page.rezepte.filter_aria")}
                            />
                        </div>
                        {medFilter ? (
                            <Button variant="ghost" onClick={() => setMedFilter("")}>{t("page.rezepte.filter_clear")}</Button>
                        ) : null}
                        <Button onClick={() => setShowCreate(true)} disabled={!selectedPatient}>{t("page.rezepte.new")}</Button>
                    </div>
                }
            />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
                <div className="card kpi"><div className="kpi-label">{t("page.rezepte.kpi.issued_7d")}</div><div className="kpi-val">{kpi.weekCount}</div></div>
                <div className="card kpi"><div className="kpi-label">{t("page.rezepte.kpi.pending")}</div><div className="kpi-val">{kpi.pending}</div></div>
                <div className="card kpi"><div className="kpi-label">{t("page.rezepte.kpi.issued_pct")}</div><div className="kpi-val">{kpi.pct}%</div></div>
            </div>

            <Card className="card-pad">
                <CardHeader title={t("page.rezepte.select_patient")} />
                {patientsLoading ? (
                    <p className="text-body text-on-surface-variant" role="status">{t("page.rezepte.loading_patients")}</p>
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
                                ? [{ value: "", label: t("page.rezepte.no_patients") }]
                                : [{ value: "", label: t("page.rezepte.choose_patient") }]),
                            ...patients.map((p) => ({ value: p.id, label: p.name })),
                        ]}
                    />
                )}
            </Card>

            {patientsLoading || patientsError ? null : !selectedPatient ? (
                <p className="text-body text-on-surface-variant">{t("page.rezepte.select_patient_hint")}</p>
            ) : listLoading ? (
                <PageLoading label={t("page.rezepte.loading")} />
            ) : listError ? (
                <PageLoadError message={listError} onRetry={() => void fetchRezepte()} />
            ) : rezepte.length === 0 ? (
                <EmptyState graphic={<PackageIcon size={40} />} title={t("page.rezepte.empty")} />
            ) : filteredRezepte.length === 0 ? (
                <EmptyState
                    graphic={<SearchIcon size={40} />}
                    title={t("page.rezepte.no_filter_results")}
                    description={t("page.rezepte.no_filter_results_desc")}
                />
            ) : (
                <div className="card tbl-data-card">
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("page.rezepte.col.medication")}</th><th>{t("page.rezepte.col.pzn")}</th><th>{t("page.rezepte.col.type")}</th><th>{t("page.rezepte.col.dosage")}</th><th>{t("page.rezepte.col.duration")}</th><th>{t("page.rezepte.col.date")}</th><th>{t("page.rezepte.col.status")}</th><th>{t("page.rezepte.col.actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRezepte.map((r) => (
                                <tr key={r.id}>
                                    <td>{r.medikament}</td>
                                    <td>{r.pzn?.trim() || "—"}</td>
                                    <td>{r.rezept_typ?.trim() || "—"}</td>
                                    <td>{r.dosierung}</td>
                                    <td>{r.dauer}</td>
                                    <td>{formatDate(r.ausgestellt_am)}</td>
                                    <td>{r.status}</td>
                                    <td className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                        <Button size="sm" onClick={() => handlePrint(r)}>{t("page.rezepte.export")}</Button>
                                        <Button size="sm" variant="ghost" onClick={() => openERezeptDialog(r)}>{t("page.rezepte.eprescription")}</Button>
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
                onClose={() => {
                    setShowCreate(false);
                    resetCreateForm();
                }}
                title={t("page.rezepte.create_title")}
                footer={<>
                    <Button
                        variant="ghost"
                        onClick={() => {
                            setShowCreate(false);
                            resetCreateForm();
                        }}
                    >
                        {t("common.cancel")}
                    </Button>
                    <Button
                        onClick={() => void handleCreate()}
                        disabled={creating || (lines.length === 0 && validateLine(draft) !== null)}
                    >
                        {creating
                            ? t("page.rezepte.saving")
                            : lines.length + (validateLine(draft) === null ? 1 : 0) > 1
                                ? tp("page.rezepte.create_many", { count: lines.length + (validateLine(draft) === null ? 1 : 0) })
                                : t("page.rezepte.create_one")}
                    </Button>
                </>}
            >
                <datalist id="rez-med-suggestions">
                    {MEDIKAMENT_SUGGESTIONS.map((s) => (
                        <option key={s.label} value={s.label} />
                    ))}
                </datalist>

                <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 0, marginBottom: 8 }}>
                    {t("page.rezepte.create_hint")}
                </p>

                {vorlagen.length > 0 ? (
                    <div style={{ marginBottom: 12 }}>
                        <Select
                            id="rez-vorlage"
                            label={t("page.rezepte.template_select")}
                            value={vorlageId}
                            onChange={(e) => applyVorlage(e.target.value)}
                            options={[
                                { value: "", label: t("page.rezepte.template_choose") },
                                ...vorlagen.map((v) => ({ value: v.id, label: v.titel })),
                            ]}
                        />
                        <p style={{ fontSize: 11, color: "var(--fg-3)", margin: "4px 0 0" }}>
                            {t("page.rezepte.template_hint")}
                        </p>
                    </div>
                ) : null}

                <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t("page.rezepte.new_line")}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Input
                            id="rez-med"
                            label={t("page.rezepte.field.medication")}
                            list="rez-med-suggestions"
                            placeholder={t("page.rezepte.field.medication_ph")}
                            value={draft.medikament}
                            onChange={(e) => pickMedikament(e.target.value)}
                            error={draftError && !draft.medikament.trim() ? draftError : undefined}
                        />
                        <Input
                            id="rez-wirk"
                            label={t("page.rezepte.field.active_ingredient")}
                            value={draft.wirkstoff}
                            onChange={(e) => setDraft({ ...draft, wirkstoff: e.target.value })}
                        />
                        <Input
                            id="rez-dos"
                            label={t("page.rezepte.field.dosage")}
                            value={draft.dosierung}
                            onChange={(e) => setDraft({ ...draft, dosierung: e.target.value })}
                            placeholder={t("page.rezepte.field.dosage_ph")}
                            error={draftError && !draft.dosierung.trim() ? draftError : undefined}
                        />
                        <Input
                            id="rez-dau"
                            label={t("page.rezepte.field.duration")}
                            value={draft.dauer}
                            onChange={(e) => setDraft({ ...draft, dauer: e.target.value })}
                            placeholder={t("page.rezepte.field.duration_ph")}
                            error={draftError && !draft.dauer.trim() ? draftError : undefined}
                        />
                    </div>
                    <Textarea
                        id="rez-hin"
                        label={t("page.rezepte.field.notes_line")}
                        value={draft.hinweise}
                        onChange={(e) => setDraft({ ...draft, hinweise: e.target.value })}
                        rows={2}
                    />
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                        <Button type="button" variant="secondary" onClick={handleAddLine} disabled={creating}>
                            {t("page.rezepte.add_line")}
                        </Button>
                    </div>
                </div>

                <Textarea
                    id="rez-shared-hinweise"
                    label={t("page.rezepte.shared_notes")}
                    value={sharedHinweise}
                    onChange={(e) => setSharedHinweise(e.target.value)}
                    rows={2}
                />

                <div style={{ marginTop: 12, border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
                        {tp("page.rezepte.lines_title", { count: lines.length })}
                    </div>
                    {lines.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", fontSize: 13, margin: 0 }}>
                            {t("page.rezepte.lines_empty")}
                        </p>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {lines.map((line, idx) => (
                                <li
                                    key={`${line.medikament}-${idx}`}
                                    className="row"
                                    style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}
                                >
                                    <div style={{ fontSize: 13 }}>
                                        <strong>{line.medikament}</strong>
                                        {line.wirkstoff ? ` (${line.wirkstoff})` : ""}
                                        {" — "}
                                        {line.dosierung}
                                        {" · "}
                                        {line.dauer}
                                        {line.hinweise ? ` · ${line.hinweise}` : ""}
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
                title={t("page.rezepte.delete_title")}
                message={t("page.rezepte.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />

            <Dialog
                open={!!eRezeptTarget}
                onClose={() => setERezeptTarget(null)}
                title={tp("page.rezepte.eprescription_title", { medication: eRezeptTarget?.medikament ?? "" })}
                footer={<>
                    <Button variant="ghost" onClick={() => setERezeptTarget(null)}>{t("common.close")}</Button>
                    <Button variant="secondary" onClick={() => void handleValidateERezept()} disabled={eRezBusy} loading={eRezBusy}>{t("page.rezepte.validate")}</Button>
                    {eprescriptionLive ? (
                        <Button onClick={() => void handleSubmitERezept()} disabled={eRezBusy} loading={eRezBusy}>{t("page.rezepte.send_ti")}</Button>
                    ) : null}
                </>}
            >
                <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "0 0 8px" }}>
                    {t("page.rezepte.eprescription_hint")}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Input id="er-kvnr" label={t("page.rezepte.field.kvnr")} value={eRez.kvnr} onChange={(e) => setERez({ ...eRez, kvnr: e.target.value })} placeholder="A123456789" />
                    <Input id="er-pzn" label={t("page.rezepte.field.pzn")} value={eRez.pzn} onChange={(e) => setERez({ ...eRez, pzn: e.target.value })} placeholder="12345678" />
                    <Input id="er-lanr" label={t("page.rezepte.field.lanr")} value={eRez.lanr} onChange={(e) => setERez({ ...eRez, lanr: e.target.value })} placeholder="123456789" />
                    <Input id="er-qty" label={t("common.quantity")} type="number" value={eRez.quantity} onChange={(e) => setERez({ ...eRez, quantity: e.target.value })} />
                </div>
            </Dialog>
            {htmlExport ? (
                <HtmlDocumentExportPickerDialog
                    open
                    onClose={() => setHtmlExport(null)}
                    templateKind="rezept"
                    exportPreviewTitle={htmlExport.exportPreviewTitle}
                    suggestedBasename={htmlExport.suggestedBasename}
                    bundle={htmlExport.bundle}
                />
            ) : null}
        </div>
    );
}
