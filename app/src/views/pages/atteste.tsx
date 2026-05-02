import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { PatientComboField } from "../components/patient-combo-field";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { Input, Select, Textarea } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { useAuthStore } from "../../models/store/auth-store";
import { listPatienten } from "../../controllers/patient.controller";
import {
    listAtteste,
    createAttest,
    deleteAttest,
    type Attest,
} from "../../controllers/attest.controller";
import type { Patient } from "../../models/types";
import { errorMessage, formatDate } from "../../lib/utils";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { HtmlDocumentExportPickerDialog } from "../components/export-picker-dialog";
import { bundleAttestExport, suggestAttestExportBasename, type ClinicalDocumentExportBundle } from "@/lib/document-print-html";

/**
 * Attestverwaltung (FA-ATT-01..04).
 */
export function AttestePage() {
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
            toast("Attest erstellt");
            setShowCreate(false);
            setForm({ typ: form.typ, inhalt: "", gueltig_von: today, gueltig_bis: today });
            await fetchAtteste();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`);
        }
    }

    async function handleDelete() {
        if (!deleteId) return;
        try {
            await deleteAttest(deleteId);
            toast("Attest gelöscht");
            setDeleteId(null);
            await fetchAtteste();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`);
        }
    }

    function openAttestExport(a: Attest) {
        const pat = patients.find((p) => p.id === a.patient_id) ?? null;
        setHtmlExport({
            bundle: bundleAttestExport(a, pat),
            suggestedBasename: suggestAttestExportBasename(a),
            exportPreviewTitle: `Attest — ${pat?.name ?? a.patient_id}`,
        });
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="page-head">
                <h2 className="page-title">Atteste</h2>
                <Button onClick={() => setShowCreate(true)} disabled={!selectedPatient}>+ Neues Attest</Button>
            </div>

            <Card className="card-pad">
                <CardHeader title="Patient auswählen" />
                {patientsLoading ? (
                    <p className="text-body text-on-surface-variant" role="status">Patienten werden geladen…</p>
                ) : patientsError ? (
                    <PageLoadError message={patientsError} onRetry={() => void loadPatients()} />
                ) : (
                    <PatientComboField
                        id="att-patient"
                        label="Patient"
                        patienten={patients}
                        patientId={selectedPatient}
                        onPatientIdChange={setSelectedPatient}
                        disabled={patients.length === 0}
                        placeholder={patients.length === 0 ? "Keine Patienten angelegt" : "Patient suchen…"}
                    />
                )}
            </Card>

            {patientsLoading || patientsError ? null : !selectedPatient ? (
                <p className="text-body text-on-surface-variant">Bitte einen Patienten auswählen.</p>
            ) : listLoading ? (
                <PageLoading label="Atteste werden geladen…" />
            ) : listError ? (
                <PageLoadError message={listError} onRetry={() => void fetchAtteste()} />
            ) : atteste.length === 0 ? (
                <EmptyState icon="📄" title="Keine Atteste vorhanden" />
            ) : (
                <div className="card">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Typ</th><th>Gültig von</th><th>Gültig bis</th><th>Ausgestellt</th><th>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {atteste.map((a) => (
                                <tr key={a.id}>
                                    <td>{a.typ}</td>
                                    <td>{formatDate(a.gueltig_von)}</td>
                                    <td>{formatDate(a.gueltig_bis)}</td>
                                    <td>{formatDate(a.ausgestellt_am)}</td>
                                    <td className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                                        <Button size="sm" onClick={() => openAttestExport(a)}>Exportieren…</Button>
                                        <Button size="sm" variant="danger" onClick={() => setDeleteId(a.id)}>Löschen</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                title="Neues Attest"
                footer={<>
                    <Button variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
                    <Button onClick={handleCreate} disabled={!form.typ || !form.inhalt}>Erstellen</Button>
                </>}
            >
                <Select
                    id="att-typ"
                    label="Attesttyp *"
                    value={form.typ}
                    onChange={(e) => setForm({ ...form, typ: e.target.value })}
                    options={[
                        { value: "Arbeitsunfähigkeitsbescheinigung", label: "Arbeitsunfähigkeitsbescheinigung" },
                        { value: "Sportbefreiung", label: "Sportbefreiung" },
                        { value: "Schulbefreiung", label: "Schulbefreiung" },
                        { value: "Behandlungsbestätigung", label: "Behandlungsbestätigung" },
                        { value: "Sonstiges", label: "Sonstiges" },
                    ]}
                />
                <div className="grid grid-cols-2 gap-3">
                    <Input id="att-vo" type="date" label="Gültig von *" value={form.gueltig_von} onChange={(e) => setForm({ ...form, gueltig_von: e.target.value })} />
                    <Input id="att-bi" type="date" label="Gültig bis *" value={form.gueltig_bis} onChange={(e) => setForm({ ...form, gueltig_bis: e.target.value })} />
                </div>
                <Textarea id="att-inh" label="Inhalt *" rows={6} value={form.inhalt} onChange={(e) => setForm({ ...form, inhalt: e.target.value })} />
            </Dialog>

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Attest löschen"
                message="Möchten Sie dieses Attest wirklich löschen?"
                confirmLabel="Löschen"
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
