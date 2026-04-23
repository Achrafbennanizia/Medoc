import { useCallback, useEffect, useState } from "react";
import { listTermine, createTermin, deleteTermin } from "../../controllers/termin.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { listAerzte, type AerztSummary } from "../../controllers/personal.controller";
import { useAuthStore } from "../../models/store/auth-store";
import { errorMessage, formatDate } from "../../lib/utils";
import type { Termin, Patient } from "../../models/types";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { Input, Select, Textarea } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";

type BadgeVariant = "primary" | "success" | "default" | "error" | "warning";

const statusBadge: Record<string, BadgeVariant> = {
    GEPLANT: "primary",
    BESTAETIGT: "success",
    DURCHGEFUEHRT: "default",
    NICHT_ERSCHIENEN: "error",
    ABGESAGT: "warning",
};

const terminArten = [
    { value: "KONTROLLE", label: "Kontrolle" },
    { value: "BEHANDLUNG", label: "Behandlung" },
    { value: "NOTFALL", label: "Notfall" },
    { value: "BERATUNG", label: "Beratung" },
];

export function TerminePage() {
    const [termine, setTermine] = useState<Termin[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [aerzte, setAerzte] = useState<AerztSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [form, setForm] = useState({
        patient_id: "",
        arzt_id: "",
        datum: "",
        uhrzeit: "",
        art: "KONTROLLE",
        beschwerden: "",
    });
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [t, p, ar] = await Promise.all([listTermine(), listPatienten(), listAerzte()]);
            setTermine(t);
            setPatienten(p);
            setAerzte(ar);
        } catch (e) {
            setLoadError(errorMessage(e));
            setTermine([]);
            setPatienten([]);
            setAerzte([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        if (!showCreate || !session) return;
        setForm((prev) => {
            if (prev.arzt_id) return prev;
            if (session.rolle === "ARZT") {
                return { ...prev, arzt_id: session.user_id };
            }
            return prev;
        });
    }, [showCreate, session]);

    const handleCreate = async () => {
        await createTermin({
            patient_id: form.patient_id,
            datum: form.datum,
            uhrzeit: form.uhrzeit,
            art: form.art,
            arzt_id: form.arzt_id,
            beschwerden: form.beschwerden || undefined,
        });
        toast("Termin erstellt");
        setShowCreate(false);
        setForm({
            patient_id: "",
            arzt_id: session?.rolle === "ARZT" ? session.user_id : "",
            datum: "",
            uhrzeit: "",
            art: "KONTROLLE",
            beschwerden: "",
        });
        load();
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        await deleteTermin(deleteId);
        toast("Termin gelöscht");
        setDeleteId(null);
        load();
    };

    return (
        <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-headline text-on-primary">Termine</h2>
                <Button onClick={() => setShowCreate(true)}>+ Neuer Termin</Button>
            </div>

            {loading ? (
                <PageLoading label="Termine werden geladen…" />
            ) : loadError ? (
                <PageLoadError message={loadError} onRetry={() => void load()} />
            ) : termine.length === 0 ? (
                <EmptyState icon="📅" title="Keine Termine vorhanden" description="Erstellen Sie einen neuen Termin." />
            ) : (
                <div className="card overflow-hidden">
                    <table className="w-full text-body">
                        <thead>
                            <tr className="border-b border-surface-container">
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Datum</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Uhrzeit</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Art</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Status</th>
                                <th className="text-left px-4 py-3 text-label text-on-surface-variant">Beschwerden</th>
                                <th className="text-right px-4 py-3 text-label text-on-surface-variant">Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {termine.map((t) => (
                                <tr key={t.id} className="border-b border-surface-container/50 hover:bg-surface-container/50 transition-colors">
                                    <td className="px-4 py-3 text-on-surface">{formatDate(t.datum)}</td>
                                    <td className="px-4 py-3 text-on-surface">{t.uhrzeit}</td>
                                    <td className="px-4 py-3 text-on-surface">{t.art}</td>
                                    <td className="px-4 py-3">
                                        <Badge variant={statusBadge[t.status] || "default"}>{t.status}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-on-surface-variant">{t.beschwerden || "–"}</td>
                                    <td className="px-4 py-3 text-right">
                                        <Button variant="danger" size="sm" onClick={() => setDeleteId(t.id)}>
                                            Löschen
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create Dialog */}
            <Dialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                title="Neuer Termin"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowCreate(false)}>Abbrechen</Button>
                        <Button
                            onClick={handleCreate}
                            disabled={
                                !form.patient_id
                                || !form.arzt_id
                                || !form.datum
                                || !form.uhrzeit
                            }
                        >
                            Erstellen
                        </Button>
                    </>
                }
            >
                <Select
                    id="patient"
                    label="Patient"
                    value={form.patient_id}
                    onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
                    options={[
                        { value: "", label: "– Patient wählen –" },
                        ...patienten.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                />
                <Select
                    id="arzt"
                    label="Behandler (Arzt)"
                    value={form.arzt_id}
                    onChange={(e) => setForm({ ...form, arzt_id: e.target.value })}
                    options={[
                        { value: "", label: aerzte.length ? "– Arzt wählen –" : "Kein Arzt im System" },
                        ...aerzte.map((a) => ({ value: a.id, label: a.name })),
                    ]}
                />
                <Input id="datum" type="date" label="Datum" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} />
                <Input id="uhrzeit" type="time" label="Uhrzeit" value={form.uhrzeit} onChange={(e) => setForm({ ...form, uhrzeit: e.target.value })} />
                <Select id="art" label="Art" value={form.art} onChange={(e) => setForm({ ...form, art: e.target.value })} options={terminArten} />
                <Textarea id="beschwerden" label="Beschwerden" value={form.beschwerden} onChange={(e) => setForm({ ...form, beschwerden: e.target.value })} />
            </Dialog>

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Termin löschen"
                message="Möchten Sie diesen Termin wirklich löschen?"
                confirmLabel="Löschen"
                danger
            />
        </div>
    );
}
