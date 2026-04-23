import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { listPatienten } from "../../controllers/patient.controller";
import {
    dsgvoExportPatient,
    dsgvoErasePatient,
    type ErasureReport,
} from "../../controllers/ops.controller";
import type { Patient } from "../../models/types";
import { errorMessage } from "../../lib/utils";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

/**
 * Datenschutz-Seite — DSGVO Art. 15 (Auskunft), 17 (Löschung), 20 (Übertragbarkeit).
 * Bündelt Patientenexport (JSON) und Löschanfrage (Pseudonymisierung mit Aufbewahrung
 * klinischer Daten bis Ablauf §630f BGB / 30 Jahre).
 */
export function DatenschutzPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [filter, setFilter] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [exportPreview, setExportPreview] = useState<string | null>(null);
    const [confirmErase, setConfirmErase] = useState<Patient | null>(null);
    const [eraseReport, setEraseReport] = useState<ErasureReport | null>(null);
    const [patientsLoading, setPatientsLoading] = useState(true);
    const [patientsError, setPatientsError] = useState<string | null>(null);
    const toast = useToastStore((s) => s.add);

    const loadPatients = useCallback(async () => {
        setPatientsLoading(true);
        setPatientsError(null);
        try {
            setPatients(await listPatienten());
        } catch (e) {
            setPatientsError(errorMessage(e));
            setPatients([]);
        } finally {
            setPatientsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadPatients();
    }, [loadPatients]);

    const filtered = patients.filter((p) =>
        p.name.toLowerCase().includes(filter.toLowerCase()),
    );

    async function handleExport(p: Patient) {
        setBusyId(p.id);
        try {
            const data = await dsgvoExportPatient(p.id);
            const json = JSON.stringify(data, null, 2);
            setExportPreview(json);
            // Browser-Download anbieten
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `dsgvo-export-${p.id}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast(`Export für ${p.name} erstellt`);
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`);
        } finally {
            setBusyId(null);
        }
    }

    async function handleErase() {
        if (!confirmErase) return;
        setBusyId(confirmErase.id);
        try {
            const report = await dsgvoErasePatient(confirmErase.id);
            setEraseReport(report);
            toast("Pseudonymisierung abgeschlossen");
            setConfirmErase(null);
            await loadPatients();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`);
        } finally {
            setBusyId(null);
        }
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <h2 className="text-headline text-on-primary">Datenschutz (DSGVO)</h2>
            <p className="text-body text-on-surface-variant">
                Bearbeitung von Betroffenenrechten nach DSGVO Art. 15 (Auskunft), Art. 17 (Löschung)
                und Art. 20 (Datenübertragbarkeit). Klinische Daten bleiben aufgrund §630f BGB
                bis zum Ablauf der Aufbewahrungsfrist erhalten und werden bei einer Löschanfrage
                <em> pseudonymisiert</em>.
            </p>

            <Card>
                <CardHeader title="Patient suchen" />
                <Input
                    id="dsgvo-filter"
                    label="Nach Namen filtern"
                    placeholder="Name eingeben…"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                />
            </Card>

            {patientsLoading ? (
                <PageLoading label="Patienten werden geladen…" />
            ) : patientsError ? (
                <PageLoadError message={patientsError} onRetry={() => void loadPatients()} />
            ) : filtered.length === 0 ? (
                <EmptyState icon="👥" title="Keine Patienten" description="Legen Sie Patienten an oder passen Sie die Suche an." />
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Name</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Status</th>
                                <th className="text-right px-4 py-3 text-label text-on-surface-variant">Aktion</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 50).map((p) => (
                                <tr key={p.id} className="border-b border-surface-container/50 hover:bg-surface-container/50">
                                    <td className="px-4 py-3 text-on-primary">{p.name}</td>
                                    <td className="px-4 py-3">{p.status}</td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <Button size="sm" onClick={() => handleExport(p)} disabled={busyId === p.id}>
                                            Export (JSON)
                                        </Button>
                                        <Button size="sm" variant="danger" onClick={() => setConfirmErase(p)} disabled={busyId === p.id}>
                                            Löschanfrage
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog open={!!exportPreview} onClose={() => setExportPreview(null)} title="Export-Vorschau">
                <pre className="font-mono text-caption max-h-96 overflow-auto bg-surface-container p-3 rounded">
                    {exportPreview}
                </pre>
            </Dialog>

            <ConfirmDialog
                open={!!confirmErase}
                onClose={() => setConfirmErase(null)}
                onConfirm={handleErase}
                title="DSGVO-Löschanfrage"
                message={`Patient "${confirmErase?.name}" pseudonymisieren? Klinische Daten bleiben gemäß §630f BGB bis zum Ablauf der Aufbewahrungsfrist erhalten.`}
                confirmLabel="Pseudonymisieren"
                danger
                loading={busyId === confirmErase?.id}
            />

            {eraseReport && (
                <Card>
                    <CardHeader title="Letzter Löschbericht" />
                    <ul className="text-body space-y-1">
                        <li>Patient-ID: <span className="font-mono">{eraseReport.patient_id}</span></li>
                        <li>Pseudonymisiert am: {eraseReport.anonymised_at}</li>
                        <li>Betroffene Datensätze: {eraseReport.deleted_records}</li>
                    </ul>
                </Card>
            )}
        </div>
    );
}
