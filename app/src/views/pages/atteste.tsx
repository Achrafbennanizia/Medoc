import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input, Textarea, Select } from "../components/ui/input";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
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

    function handlePrint(a: Attest) {
        const patient = patients.find((p) => p.id === a.patient_id);
        const w = window.open("", "_blank", "width=600,height=800");
        if (!w) return;
        w.document.write(`<!doctype html><html><head><title>Attest ${a.id}</title>
            <style>body{font-family:Helvetica,Arial,sans-serif;padding:2cm;color:#000}
            h1{font-size:18pt}.row{margin:0.3cm 0}.label{display:inline-block;width:4cm;color:#555}
            .body{margin:1cm 0;white-space:pre-wrap}</style></head><body>
            <h1>${a.typ}</h1>
            <div class="row"><span class="label">Patient:</span>${patient?.name ?? a.patient_id}</div>
            <div class="row"><span class="label">Geburtsdatum:</span>${patient ? formatDate(patient.geburtsdatum) : ""}</div>
            <div class="row"><span class="label">Gültig:</span>${formatDate(a.gueltig_von)} – ${formatDate(a.gueltig_bis)}</div>
            <div class="row"><span class="label">Ausgestellt:</span>${formatDate(a.ausgestellt_am)}</div>
            <hr/>
            <div class="body">${a.inhalt.replace(/</g, "&lt;")}</div>
            <p style="margin-top:3cm">______________________<br/>Unterschrift Ärztin/Arzt</p>
            <script>window.print();</script></body></html>`);
        w.document.close();
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h2 className="text-headline text-on-primary">Atteste</h2>
                <Button onClick={() => setShowCreate(true)} disabled={!selectedPatient}>+ Neues Attest</Button>
            </div>

            <Card>
                <CardHeader title="Patient auswählen" />
                {patientsLoading ? (
                    <p className="text-body text-on-surface-variant" role="status">Patienten werden geladen…</p>
                ) : patientsError ? (
                    <PageLoadError message={patientsError} onRetry={() => void loadPatients()} />
                ) : (
                    <Select
                        id="att-patient"
                        value={selectedPatient}
                        onChange={(e) => setSelectedPatient(e.target.value)}
                        disabled={patients.length === 0}
                        options={[
                            ...(patients.length === 0
                                ? [{ value: "", label: "Keine Patienten angelegt" }]
                                : [{ value: "", label: "– Patient wählen –" }]),
                            ...patients.map((p) => ({ value: p.id, label: p.name })),
                        ]}
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
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Typ</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Gültig von</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Gültig bis</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Ausgestellt</th>
                                <th className="text-right px-4 py-3 text-label text-on-surface-variant">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {atteste.map((a) => (
                                <tr key={a.id} className="border-b border-surface-container/50 hover:bg-surface-container/50">
                                    <td className="px-4 py-3 text-on-primary font-medium">{a.typ}</td>
                                    <td className="px-4 py-3">{formatDate(a.gueltig_von)}</td>
                                    <td className="px-4 py-3">{formatDate(a.gueltig_bis)}</td>
                                    <td className="px-4 py-3">{formatDate(a.ausgestellt_am)}</td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <Button size="sm" onClick={() => handlePrint(a)}>Drucken</Button>
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
        </div>
    );
}
