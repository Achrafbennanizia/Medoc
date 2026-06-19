import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { PatientComboField } from "../components/patient-combo-field";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { Input, Select, Textarea } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { useAuthStore } from "../../models/store/auth-store";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import {
    listAtteste,
    createAttest,
    deleteAttest,
    type Attest,
} from "@/systems/practice-host/controllers/attest.controller";
import type { Patient } from "../../models/types";
import { errorMessage, formatDate } from "@/lib/utils";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { HtmlDocumentExportPickerDialog } from "../components/export-picker-dialog";
import { bundleAttestExport, suggestAttestExportBasename, type ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import { useT, useTParams } from "@/lib/i18n";

/**
 * Attestverwaltung (FA-ATT-01..04).
 */
export function AttestePage() {
    const t = useT();
    const tp = useTParams();
    const session = useAuthStore((s) => s.session);
    const toast = useToastStore((s) => s.add);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [patientsError, setPatientsError] = useState<string | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<string>("");
    const [atteste, setAtteste] = useState<Attest[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [htmlExport, setHtmlExport] = useState<{
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
    } | null>(null);
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({
        typ: "Arbeitsunfähigkeitsbescheinigung",
        inhalt: "",
        gueltig_von: today,
        gueltig_bis: today,
    });

    const attestTypeOptions = useMemo(
        () => [
            { value: "Arbeitsunfähigkeitsbescheinigung", label: t("page.atteste.type.arbeitsunfaehigkeit") },
            { value: "Sportbefreiung", label: t("page.atteste.type.sport") },
            { value: "Schulbefreiung", label: t("page.atteste.type.schule") },
            { value: "Behandlungsbestätigung", label: t("page.atteste.type.behandlung") },
            { value: "Sonstiges", label: t("page.atteste.type.sonstiges") },
        ],
        [t],
    );

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

    const fetchAtteste = useCallback(async () => {
        if (!selectedPatient) {
            setAtteste([]);
            setListError(null);
            setListLoading(false);
            return;
        }
        setListLoading(true);
        setListError(null);
        try {
            setAtteste(await listAtteste(selectedPatient));
        } catch (e) {
            setListError(errorMessage(e));
            setAtteste([]);
        } finally {
            setListLoading(false);
        }
    }, [selectedPatient]);

    useEffect(() => {
        void fetchAtteste();
    }, [fetchAtteste]);

    async function handleCreate() {
        if (!selectedPatient || !session) return;
        try {
            await createAttest({
                patient_id: selectedPatient,
                arzt_id: session.user_id,
                typ: form.typ,
                inhalt: form.inhalt,
                gueltig_von: form.gueltig_von,
                gueltig_bis: form.gueltig_bis,
            });
            toast(t("page.atteste.toast.created"));
            setShowCreate(false);
            setForm({ typ: form.typ, inhalt: "", gueltig_von: today, gueltig_bis: today });
            await fetchAtteste();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
        }
    }

    async function handleDelete() {
        if (!deleteId) return;
        try {
            await deleteAttest(deleteId);
            toast(t("page.atteste.toast.deleted"));
            setDeleteId(null);
            await fetchAtteste();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
        }
    }

    function openAttestExport(a: Attest) {
        const pat = patients.find((p) => p.id === a.patient_id) ?? null;
        setHtmlExport({
            bundle: bundleAttestExport(a, pat),
            suggestedBasename: suggestAttestExportBasename(a),
            exportPreviewTitle: tp("page.atteste.export_preview", { name: pat?.name ?? a.patient_id }),
        });
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <WorkspacePageHeader
                title={t("page.atteste.title")}
                actions={
                    <Button onClick={() => setShowCreate(true)} disabled={!selectedPatient}>
                        {t("page.atteste.new")}
                    </Button>
                }
            />

            <Card className="card-pad">
                <CardHeader title={t("page.atteste.select_patient")} />
                {patientsLoading ? (
                    <p className="text-body text-on-surface-variant" role="status">{t("common.loading_patients")}</p>
                ) : patientsError ? (
                    <PageLoadError message={patientsError} onRetry={() => void loadPatients()} />
                ) : (
                    <PatientComboField
                        id="att-patient"
                        label={t("common.patient")}
                        patienten={patients}
                        patientId={selectedPatient}
                        onPatientIdChange={setSelectedPatient}
                        disabled={patients.length === 0}
                        placeholder={patients.length === 0 ? t("page.rezepte.no_patients") : t("common.search_patient_ph")}
                    />
                )}
            </Card>

            {patientsLoading || patientsError ? null : !selectedPatient ? (
                <p className="text-body text-on-surface-variant">{t("page.atteste.select_patient_hint")}</p>
            ) : listLoading ? (
                <PageLoading label={t("page.atteste.loading")} />
            ) : listError ? (
                <PageLoadError message={listError} onRetry={() => void fetchAtteste()} />
            ) : atteste.length === 0 ? (
                <EmptyState icon="📄" title={t("page.atteste.empty")} />
            ) : (
                <div className="card tbl-data-card">
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("common.type")}</th>
                                <th>{t("page.patient_detail.attest.field.icd")}</th>
                                <th>{t("common.valid_from")}</th>
                                <th>{t("common.valid_until")}</th>
                                <th>{t("common.issued")}</th>
                                <th>{t("common.actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {atteste.map((a) => (
                                <tr key={a.id}>
                                    <td>{a.typ}</td>
                                    <td>{a.icd10_code?.trim() || "—"}</td>
                                    <td>{formatDate(a.gueltig_von)}</td>
                                    <td>{formatDate(a.gueltig_bis)}</td>
                                    <td>{formatDate(a.ausgestellt_am)}</td>
                                    <td className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                        <Button size="sm" onClick={() => openAttestExport(a)}>{t("common.export")}</Button>
                                        <Button size="sm" variant="danger" onClick={() => setDeleteId(a.id)}>{t("common.delete")}</Button>
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
                onClose={() => setShowCreate(false)}
                title={t("page.atteste.create_title")}
                footer={<>
                    <Button variant="ghost" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
                    <Button onClick={handleCreate} disabled={!form.typ || !form.inhalt}>{t("common.create")}</Button>
                </>}
            >
                <Select
                    id="att-typ"
                    label={t("page.atteste.field.type")}
                    value={form.typ}
                    onChange={(e) => setForm({ ...form, typ: e.target.value })}
                    options={attestTypeOptions}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Input id="att-vo" type="date" label={`${t("common.valid_from")} *`} value={form.gueltig_von} onChange={(e) => setForm({ ...form, gueltig_von: e.target.value })} />
                    <Input id="att-bi" type="date" label={`${t("common.valid_until")} *`} value={form.gueltig_bis} onChange={(e) => setForm({ ...form, gueltig_bis: e.target.value })} />
                </div>
                <Textarea id="att-inh" label={t("page.atteste.field.content")} rows={6} value={form.inhalt} onChange={(e) => setForm({ ...form, inhalt: e.target.value })} />
            </Dialog>

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title={t("page.atteste.delete_title")}
                message={t("page.atteste.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />
            {htmlExport ? (
                <HtmlDocumentExportPickerDialog
                    open
                    onClose={() => setHtmlExport(null)}
                    templateKind="attest"
                    exportPreviewTitle={htmlExport.exportPreviewTitle}
                    suggestedBasename={htmlExport.suggestedBasename}
                    bundle={htmlExport.bundle}
                />
            ) : null}
        </div>
    );
}
