import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { PatientComboField } from "../components/patient-combo-field";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { Input, Select, Textarea } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { useAuthStore } from "../../models/store/auth-store";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import {
    listCertificates,
    createCertificate,
    deleteCertificate,
    type Certificate,
} from "@/systems/practice-host/controllers/certificate.controller";
import type { Patient } from "../../models/types";
import { errorMessage, formatDate } from "@/lib/utils";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { HtmlDocumentExportPickerDialog } from "../components/export-picker-dialog";
import { bundleCertificateExport, suggestCertificateExportBasename, type ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import { useT, useTParams } from "@/lib/i18n";

/**
 * Certificate management (FA-ATT-01..04).
 */
export function CertificatesPage() {
    const t = useT();
    const tp = useTParams();
    const session = useAuthStore((s) => s.session);
    const toast = useToastStore((s) => s.add);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [patientsError, setPatientsError] = useState<string | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<string>("");
    const [certificates, setCertificates] = useState<Certificate[]>([]);
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
        kind: "SICK_LEAVE",
        body_text: "",
        valid_from: today,
        valid_until: today,
    });

    const certificateTypeOptions = useMemo(
        () => [
            { value: "SICK_LEAVE", label: t("page.certificates.type.incapacity") },
            { value: "SPORTS_EXEMPTION", label: t("page.certificates.type.sport") },
            { value: "SCHOOL_EXEMPTION", label: t("page.certificates.type.school") },
            { value: "TREATMENT_CONFIRMATION", label: t("page.certificates.type.treatment") },
            { value: "OTHER", label: t("page.certificates.type.other") },
        ],
        [t],
    );

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

    const fetchCertificates = useCallback(async () => {
        if (!selectedPatient) {
            setCertificates([]);
            setListError(null);
            setListLoading(false);
            return;
        }
        setListLoading(true);
        setListError(null);
        try {
            setCertificates(await listCertificates(selectedPatient));
        } catch (e) {
            setListError(errorMessage(e));
            setCertificates([]);
        } finally {
            setListLoading(false);
        }
    }, [selectedPatient]);

    useEffect(() => {
        void fetchCertificates();
    }, [fetchCertificates]);

    async function handleCreate() {
        if (!selectedPatient || !session) return;
        try {
            await createCertificate({
                patient_id: selectedPatient,
                physician_id: session.user_id,
                kind: form.kind,
                body_text: form.body_text,
                valid_from: form.valid_from,
                valid_until: form.valid_until,
            });
            toast(t("page.certificates.toast.created"));
            setShowCreate(false);
            setForm({ kind: form.kind, body_text: "", valid_from: today, valid_until: today });
            await fetchCertificates();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
        }
    }

    async function handleDelete() {
        if (!deleteId) return;
        try {
            await deleteCertificate(deleteId);
            toast(t("page.certificates.toast.deleted"));
            setDeleteId(null);
            await fetchCertificates();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`);
        }
    }

    function openCertificateExport(a: Certificate) {
        const pat = patients.find((p) => p.id === a.patient_id) ?? null;
        setHtmlExport({
            bundle: bundleCertificateExport(a, pat),
            suggestedBasename: suggestCertificateExportBasename(a),
            exportPreviewTitle: tp("page.certificates.export_preview", { name: pat?.name ?? a.patient_id }),
        });
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <WorkspacePageHeader
                title={t("page.certificates.title")}
                actions={
                    <Button onClick={() => setShowCreate(true)} disabled={!selectedPatient}>
                        {t("page.certificates.new")}
                    </Button>
                }
            />

            <Card className="card-pad">
                <CardHeader title={t("page.certificates.select_patient")} />
                {patientsLoading ? (
                    <p className="text-body text-on-surface-variant" role="status">{t("common.loading_patients")}</p>
                ) : patientsError ? (
                    <PageLoadError message={patientsError} onRetry={() => void loadPatients()} />
                ) : (
                    <PatientComboField
                        id="att-patient"
                        label={t("common.patient")}
                        patients={patients}
                        patientId={selectedPatient}
                        onPatientIdChange={setSelectedPatient}
                        disabled={patients.length === 0}
                        placeholder={patients.length === 0 ? t("page.prescriptions.no_patients") : t("common.search_patient_ph")}
                    />
                )}
            </Card>

            {patientsLoading || patientsError ? null : !selectedPatient ? (
                <p className="text-body text-on-surface-variant">{t("page.certificates.select_patient_hint")}</p>
            ) : listLoading ? (
                <PageLoading label={t("page.certificates.loading")} />
            ) : listError ? (
                <PageLoadError message={listError} onRetry={() => void fetchCertificates()} />
            ) : certificates.length === 0 ? (
                <EmptyState icon="📄" title={t("page.certificates.empty")} />
            ) : (
                <div className="card tbl-data-card">
                    <div className="tbl-scroll">
                    <table className="tbl tbl-fluid">
                        <thead>
                            <tr>
                                <th>{t("common.type")}</th>
                                <th>{t("page.patient_detail.certificate.field.icd")}</th>
                                <th>{t("common.valid_from")}</th>
                                <th>{t("common.valid_until")}</th>
                                <th>{t("common.issued")}</th>
                                <th>{t("common.actions")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {certificates.map((a) => (
                                <tr key={a.id}>
                                    <td>{a.kind}</td>
                                    <td>{a.icd10_code?.trim() || "—"}</td>
                                    <td>{formatDate(a.valid_from)}</td>
                                    <td>{formatDate(a.valid_until)}</td>
                                    <td>{formatDate(a.issued_at)}</td>
                                    <td className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                        <Button size="sm" onClick={() => openCertificateExport(a)}>{t("common.export")}</Button>
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
                title={t("page.certificates.create_title")}
                footer={<>
                    <Button variant="ghost" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
                    <Button onClick={handleCreate} disabled={!form.kind || !form.body_text}>{t("common.create")}</Button>
                </>}
            >
                <Select
                    id="att-kind"
                    label={t("page.certificates.field.type")}
                    value={form.kind}
                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                    options={certificateTypeOptions}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Input id="att-vo" type="date" label={`${t("common.valid_from")} *`} value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
                    <Input id="att-bi" type="date" label={`${t("common.valid_until")} *`} value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
                </div>
                <Textarea id="att-inh" label={t("page.certificates.field.content")} rows={6} value={form.body_text} onChange={(e) => setForm({ ...form, body_text: e.target.value })} />
            </Dialog>

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title={t("page.certificates.delete_title")}
                message={t("page.certificates.delete_message")}
                confirmLabel={t("common.delete")}
                danger
            />
            {htmlExport ? (
                <HtmlDocumentExportPickerDialog
                    open
                    onClose={() => setHtmlExport(null)}
                    templateKind="certificate"
                    exportPreviewTitle={htmlExport.exportPreviewTitle}
                    suggestedBasename={htmlExport.suggestedBasename}
                    bundle={htmlExport.bundle}
                />
            ) : null}
        </div>
    );
}
