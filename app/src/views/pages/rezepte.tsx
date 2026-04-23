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
    listRezepte,
    createRezept,
    deleteRezept,
    type Rezept,
} from "../../controllers/rezept.controller";
import type { Patient } from "../../models/types";
import { errorMessage, formatDate } from "../../lib/utils";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

/**
 * Rezeptverwaltung (FA-REZ-01..05).
 * Pro Patient: Liste, Erstellung, Löschung. Druck/Print via Browser-Druckdialog.
 */
export function RezeptePage() {
    const session = useAuthStore((s) => s.session);
    const toast = useToastStore((s) => s.add);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [patientsError, setPatientsError] = useState<string | null>(null);
    const [selectedPatient, setSelectedPatient] = useState<string>("");
    const [rezepte, setRezepte] = useState<Rezept[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [form, setForm] = useState({
        medikament: "", wirkstoff: "", dosierung: "", dauer: "", hinweise: "",
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

    async function handleCreate() {
        if (!selectedPatient || !session) return;
        try {
            await createRezept({
                patient_id: selectedPatient,
                arzt_id: session.user_id,
                medikament: form.medikament,
                wirkstoff: form.wirkstoff || null,
                dosierung: form.dosierung,
                dauer: form.dauer,
                hinweise: form.hinweise || null,
            });
            toast("Rezept erstellt");
            setShowCreate(false);
            setForm({ medikament: "", wirkstoff: "", dosierung: "", dauer: "", hinweise: "" });
            await fetchRezepte();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`);
        }
    }

    async function handleDelete() {
        if (!deleteId) return;
        try {
            await deleteRezept(deleteId);
            toast("Rezept gelöscht");
            setDeleteId(null);
            await fetchRezepte();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`);
        }
    }

    function handlePrint(r: Rezept) {
        const patient = patients.find((p) => p.id === r.patient_id);
        const w = window.open("", "_blank", "width=600,height=800");
        if (!w) return;
        w.document.write(`<!doctype html><html><head><title>Rezept ${r.id}</title>
            <style>body{font-family:Helvetica,Arial,sans-serif;padding:2cm;color:#000}
            h1{font-size:18pt;margin-bottom:0.5cm}.row{margin:0.3cm 0}.label{display:inline-block;width:4cm;color:#555}</style>
            </head><body>
            <h1>Rezept</h1>
            <div class="row"><span class="label">Patient:</span>${patient?.name ?? r.patient_id}</div>
            <div class="row"><span class="label">Geburtsdatum:</span>${patient ? formatDate(patient.geburtsdatum) : ""}</div>
            <div class="row"><span class="label">Datum:</span>${formatDate(r.ausgestellt_am)}</div>
            <hr/>
            <div class="row"><span class="label">Medikament:</span><strong>${r.medikament}</strong></div>
            ${r.wirkstoff ? `<div class="row"><span class="label">Wirkstoff:</span>${r.wirkstoff}</div>` : ""}
            <div class="row"><span class="label">Dosierung:</span>${r.dosierung}</div>
            <div class="row"><span class="label">Dauer:</span>${r.dauer}</div>
            ${r.hinweise ? `<div class="row"><span class="label">Hinweise:</span>${r.hinweise}</div>` : ""}
            <p style="margin-top:3cm">______________________<br/>Unterschrift Ärztin/Arzt</p>
            <script>window.print();</script></body></html>`);
        w.document.close();
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <h2 className="text-headline text-on-primary">Rezepte</h2>
                <Button onClick={() => setShowCreate(true)} disabled={!selectedPatient}>+ Neues Rezept</Button>
            </div>

            <Card>
                <CardHeader title="Patient auswählen" />
                {patientsLoading ? (
                    <p className="text-body text-on-surface-variant" role="status">Patienten werden geladen…</p>
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
                <PageLoading label="Rezepte werden geladen…" />
            ) : listError ? (
                <PageLoadError message={listError} onRetry={() => void fetchRezepte()} />
            ) : rezepte.length === 0 ? (
                <EmptyState icon="💊" title="Keine Rezepte vorhanden" />
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Medikament</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Dosierung</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Dauer</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Datum</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Status</th>
                                <th className="text-right px-4 py-3 text-label text-on-surface-variant">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rezepte.map((r) => (
                                <tr key={r.id} className="border-b border-surface-container/50 hover:bg-surface-container/50">
                                    <td className="px-4 py-3 text-on-primary font-medium">{r.medikament}</td>
                                    <td className="px-4 py-3">{r.dosierung}</td>
                                    <td className="px-4 py-3">{r.dauer}</td>
                                    <td className="px-4 py-3">{formatDate(r.ausgestellt_am)}</td>
                                    <td className="px-4 py-3">{r.status}</td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <Button size="sm" onClick={() => handlePrint(r)}>Drucken</Button>
                                        <Button size="sm" variant="danger" onClick={() => setDeleteId(r.id)}>Löschen</Button>
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
                title="Neues Rezept"
                footer={<>
                    <Button variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
                    <Button onClick={handleCreate} disabled={!form.medikament || !form.dosierung || !form.dauer}>Erstellen</Button>
                </>}
            >
                <Input id="rez-med" label="Medikament *" value={form.medikament} onChange={(e) => setForm({ ...form, medikament: e.target.value })} />
                <Input id="rez-wirk" label="Wirkstoff" value={form.wirkstoff} onChange={(e) => setForm({ ...form, wirkstoff: e.target.value })} />
                <Input id="rez-dos" label="Dosierung *" value={form.dosierung} onChange={(e) => setForm({ ...form, dosierung: e.target.value })} placeholder="z. B. 1-0-1" />
                <Input id="rez-dau" label="Dauer *" value={form.dauer} onChange={(e) => setForm({ ...form, dauer: e.target.value })} placeholder="z. B. 7 Tage" />
                <Textarea id="rez-hin" label="Hinweise" value={form.hinweise} onChange={(e) => setForm({ ...form, hinweise: e.target.value })} />
            </Dialog>

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Rezept löschen"
                message="Möchten Sie dieses Rezept wirklich löschen?"
                confirmLabel="Löschen"
                danger
            />
        </div>
    );
}
