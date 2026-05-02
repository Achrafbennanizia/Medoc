import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPatient } from "../../controllers/patient.controller";
import { listRezepte, updateRezept, type Rezept } from "../../controllers/rezept.controller";
import { errorMessage } from "../../lib/utils";
import type { Patient } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { ChevronLeftIcon } from "@/lib/icons";

export function RezeptEditPage() {
    const { id: patientId, rezeptId } = useParams<{ id: string; rezeptId: string }>();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);

    const [patient, setPatient] = useState<Patient | null>(null);
    const [rezept, setRezept] = useState<Rezept | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [medikament, setMedikament] = useState("");
    const [wirkstoff, setWirkstoff] = useState("");
    const [dosierung, setDosierung] = useState("");
    const [dauer, setDauer] = useState("");
    const [hinweise, setHinweise] = useState("");

    const load = useCallback(async () => {
        if (!patientId || !rezeptId) return;
        setLoading(true);
        setLoadError(null);
        try {
            const [p, all] = await Promise.all([getPatient(patientId), listRezepte(patientId)]);
            setPatient(p);
            const r = all.find((x) => x.id === rezeptId) ?? null;
            setRezept(r);
            if (r) {
                setMedikament(r.medikament);
                setWirkstoff(r.wirkstoff ?? "");
                setDosierung(r.dosierung);
                setDauer(r.dauer);
                setHinweise(r.hinweise ?? "");
            }
        } catch (e) {
            setLoadError(errorMessage(e));
            setPatient(null);
            setRezept(null);
        } finally {
            setLoading(false);
        }
    }, [patientId, rezeptId]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleSave = async () => {
        if (!rezept || !session) return;
        if (!medikament.trim() || !dosierung.trim() || !dauer.trim()) {
            toast("Medikament, Dosierung und Dauer sind Pflichtfelder.", "error");
            return;
        }
        setSaving(true);
        try {
            await updateRezept({
                id: rezept.id,
                medikament: medikament.trim(),
                wirkstoff: wirkstoff.trim() || null,
                dosierung: dosierung.trim(),
                dauer: dauer.trim(),
                hinweise: hinweise.trim() || null,
            });
            toast("Rezept gespeichert", "success");
            navigate(`/patienten/${patientId}#rezept`);
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        } finally {
            setSaving(false);
        }
    };

    if (!patientId || !rezeptId) {
        return (
            <div className="animate-fade-in p-4">
                <p className="text-body text-on-surface-variant">Ungültiger Aufruf.</p>
            </div>
        );
    }

    if (loading) return <PageLoading label="Wird geladen…" />;
    if (loadError || !patient) {
        return <PageLoadError message={loadError ?? "Daten nicht gefunden."} onRetry={() => void load()} />;
    }

    if (!rezept) {
        return (
            <div className="animate-fade-in space-y-4" style={{ maxWidth: 560 }}>
                <Button variant="secondary" onClick={() => navigate(`/patienten/${patientId}#rezept`)}>
                    <ChevronLeftIcon />Zurück zur Akte
                </Button>
                <PageLoadError message="Dieses Rezept existiert nicht oder wurde entfernt." onRetry={() => void load()} />
            </div>
        );
    }

    const back = () => navigate(`/patienten/${patientId}#rezept`);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }} className="animate-fade-in">
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={back}>
                    <ChevronLeftIcon />Zurück zur Akte
                </Button>
                <div>
                    <div className="page-sub page-sub-caps">
                        {patient.name}
                    </div>
                    <h1 className="page-title" style={{ margin: 0 }}>Rezept bearbeiten</h1>
                </div>
            </div>

            <Card>
                <CardHeader
                    title="Medikation"
                    subtitle="Änderungen gelten für diese eine Rezeptzeile in der Akte."
                />
                <div style={{ padding: "0 16px 16px" }}>
                    <Input
                        id="re-edit-med"
                        label="Medikament *"
                        value={medikament}
                        onChange={(e) => setMedikament(e.target.value)}
                    />
                    <Input
                        id="re-edit-wirk"
                        label="Wirkstoff"
                        value={wirkstoff}
                        onChange={(e) => setWirkstoff(e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            id="re-edit-dos"
                            label="Dosierung *"
                            value={dosierung}
                            onChange={(e) => setDosierung(e.target.value)}
                            placeholder="z. B. 1-0-1"
                        />
                        <Input
                            id="re-edit-dauer"
                            label="Dauer *"
                            value={dauer}
                            onChange={(e) => setDauer(e.target.value)}
                            placeholder="z. B. 7 Tage"
                        />
                    </div>
                    <Textarea
                        id="re-edit-hin"
                        label="Hinweise"
                        rows={3}
                        value={hinweise}
                        onChange={(e) => setHinweise(e.target.value)}
                    />
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                        <Button variant="ghost" onClick={back} disabled={saving}>
                            Abbrechen
                        </Button>
                        <Button onClick={() => void handleSave()} loading={saving} disabled={saving}>
                            Speichern
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
