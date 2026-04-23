import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPatient } from "../../controllers/patient.controller";
import {
    getAkte,
    listZahnbefunde,
    createZahnbefund,
    getAnamnesebogen,
    saveAnamnesebogen,
    exportAktePdf,
    listBehandlungen,
    listUntersuchungen,
    createBehandlung,
    createUntersuchung,
} from "../../controllers/akte.controller";
import { formatDate, formatDateTime } from "../../lib/utils";
import { allowed, parseRole } from "../../lib/rbac";
import type { Patient, Patientenakte, Zahnbefund, Behandlung, Untersuchung } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Card, CardHeader } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { Input, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading } from "../components/ui/page-status";

function isPatientenakteMissingError(e: unknown): boolean {
    const m = e instanceof Error ? e.message : String(e);
    return m.includes("Patientenakte nicht gefunden") || /Patientenakte.*?nicht gefunden/i.test(m);
}

export function PatientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const role = session?.rolle ? parseRole(session.rolle) : null;
    const canViewClinical = role != null && allowed("patient.read_medical", role);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [patientLoadError, setPatientLoadError] = useState<string | null>(null);
    const [akteLoadError, setAkteLoadError] = useState<string | null>(null);
    const [akte, setAkte] = useState<Patientenakte | null>(null);
    const [befunde, setBefunde] = useState<Zahnbefund[]>([]);
    const [behandlungen, setBehandlungen] = useState<Behandlung[]>([]);
    const [untersuchungen, setUntersuchungen] = useState<Untersuchung[]>([]);
    const [anamneseJson, setAnamneseJson] = useState("");
    const [anamneseSign, setAnamneseSign] = useState(false);
    const [showBefund, setShowBefund] = useState(false);
    const [showBehandlung, setShowBehandlung] = useState(false);
    const [showUntersuchung, setShowUntersuchung] = useState(false);
    const [pdfBusy, setPdfBusy] = useState(false);
    const [befundForm, setBefundForm] = useState({ zahnnummer: "", befund: "", behandlung: "" });
    const [behandlungForm, setBehandlungForm] = useState({
        art: "", beschreibung: "", zaehne: "", material: "", notizen: "",
    });
    const [untersuchungForm, setUntersuchungForm] = useState({
        beschwerden: "", ergebnisse: "", diagnose: "",
    });
    const toast = useToastStore((s) => s.add);

    const load = useCallback(async () => {
        if (!id) return;
        setPatientLoadError(null);
        setAkteLoadError(null);
        try {
            const p = await getPatient(id);
            setPatient(p);
        } catch (e) {
            setPatient(null);
            setPatientLoadError(e instanceof Error ? e.message : String(e));
            setAkte(null);
            setBefunde([]);
            setBehandlungen([]);
            setUntersuchungen([]);
            return;
        }
        setBefunde([]);
        setBehandlungen([]);
        setUntersuchungen([]);
        setAnamneseJson("");
        setAnamneseSign(false);
        try {
            const a = await getAkte(id);
            setAkte(a);
            if (canViewClinical) {
                const [z, bh, u, am] = await Promise.all([
                    listZahnbefunde(a.id),
                    listBehandlungen(a.id),
                    listUntersuchungen(a.id),
                    getAnamnesebogen(id),
                ]);
                setBefunde(z);
                setBehandlungen(bh);
                setUntersuchungen(u);
                if (am) {
                    try {
                        setAnamneseJson(JSON.stringify(JSON.parse(am.antworten), null, 2));
                    } catch {
                        setAnamneseJson(am.antworten);
                    }
                    setAnamneseSign(am.unterschrieben);
                }
            }
        } catch (e) {
            setAkte(null);
            setBefunde([]);
            setBehandlungen([]);
            setUntersuchungen([]);
            if (isPatientenakteMissingError(e)) {
                setAkteLoadError(null);
            } else {
                setAkteLoadError(e instanceof Error ? e.message : String(e));
            }
        }
    }, [id, canViewClinical]);

    useEffect(() => { load(); }, [load]);

    const handleCreateBefund = async () => {
        if (!akte) return;
        try {
            await createZahnbefund({
                akte_id: akte.id,
                zahn_nummer: Number(befundForm.zahnnummer),
                befund: befundForm.befund,
                notizen: befundForm.behandlung || undefined,
            });
            toast("Zahnbefund erstellt");
            setShowBefund(false);
            setBefundForm({ zahnnummer: "", befund: "", behandlung: "" });
            load();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
        }
    };

    const handlePdfExport = async () => {
        if (!id) return;
        setPdfBusy(true);
        try {
            const b64 = await exportAktePdf(id);
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blob = new Blob([bytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `akte-${id}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            toast("PDF exportiert");
        } catch (e) {
            toast(`Fehler: ${(e as Error).message ?? e}`);
        } finally {
            setPdfBusy(false);
        }
    };

    const handleCreateBehandlung = async () => {
        if (!akte || !behandlungForm.art.trim()) return;
        await createBehandlung({
            akte_id: akte.id,
            art: behandlungForm.art.trim(),
            beschreibung: behandlungForm.beschreibung || null,
            zaehne: behandlungForm.zaehne || null,
            material: behandlungForm.material || null,
            notizen: behandlungForm.notizen || null,
        });
        toast("Behandlung dokumentiert");
        setShowBehandlung(false);
        setBehandlungForm({ art: "", beschreibung: "", zaehne: "", material: "", notizen: "" });
        load();
    };

    const handleCreateUntersuchung = async () => {
        if (!akte) return;
        await createUntersuchung({
            akte_id: akte.id,
            beschwerden: untersuchungForm.beschwerden || null,
            ergebnisse: untersuchungForm.ergebnisse || null,
            diagnose: untersuchungForm.diagnose || null,
        });
        toast("Untersuchung erfasst");
        setShowUntersuchung(false);
        setUntersuchungForm({ beschwerden: "", ergebnisse: "", diagnose: "" });
        load();
    };

    const handleSaveAnamnese = async () => {
        if (!id) return;
        let antworten: unknown;
        try {
            antworten = JSON.parse(anamneseJson || "{}");
        } catch {
            toast("Anamnese: Ungültiges JSON");
            return;
        }
        await saveAnamnesebogen({
            patient_id: id,
            antworten,
            unterschrieben: anamneseSign,
        });
        toast("Anamnese gespeichert");
        load();
    };

    if (!id) {
        return (
            <div className="animate-fade-in">
                <Button variant="ghost" size="sm" onClick={() => navigate("/patienten")}>← Zurück</Button>
                <p className="text-body text-on-surface-variant mt-4">Kein Patient ausgewählt.</p>
            </div>
        );
    }

    if (patientLoadError) {
        return (
            <div className="space-y-4 animate-fade-in">
                <Button variant="ghost" size="sm" onClick={() => navigate("/patienten")}>← Zurück</Button>
                <div className="rounded-lg bg-error-container text-error px-4 py-3 text-body max-w-xl">
                    {patientLoadError}
                </div>
                <Button onClick={() => load()}>Erneut versuchen</Button>
            </div>
        );
    }

    if (!patient) return <PageLoading label="Patient wird geladen…" />;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4 flex-wrap">
                <Button variant="ghost" size="sm" onClick={() => navigate("/patienten")}>← Zurück</Button>
                <h2 className="text-headline text-on-primary">{patient.name}</h2>
                <Badge variant="primary">{patient.status}</Badge>
                {canViewClinical && akte && (
                    <Button size="sm" variant="ghost" disabled={pdfBusy} onClick={handlePdfExport}>
                        {pdfBusy ? "PDF …" : "PDF exportieren"}
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader title="Stammdaten" />
                    <dl className="space-y-3 text-body">
                        {[
                            ["Geburtsdatum", formatDate(patient.geburtsdatum)],
                            ["Geschlecht", patient.geschlecht],
                            ["Versicherungs-Nr.", patient.versicherungsnummer],
                            ["Telefon", patient.telefon || "–"],
                            ["E-Mail", patient.email || "–"],
                            ["Adresse", patient.adresse || "–"],
                        ].map(([label, value]) => (
                            <div key={label} className="flex justify-between">
                                <dt className="text-on-surface-variant">{label}</dt>
                                <dd className="text-on-surface">{value}</dd>
                            </div>
                        ))}
                    </dl>
                </Card>

                <Card>
                    <CardHeader title="Patientenakte" />
                    {akteLoadError ? (
                        <div className="space-y-2">
                            <p className="text-body text-error">Akte konnte nicht geladen werden.</p>
                            <p className="text-caption text-on-surface-variant">{akteLoadError}</p>
                            <Button size="sm" variant="ghost" onClick={() => load()}>Erneut versuchen</Button>
                        </div>
                    ) : akte ? (
                        <dl className="space-y-3 text-body">
                            <div className="flex justify-between">
                                <dt className="text-on-surface-variant">Status</dt>
                                <dd><Badge>{akte.status}</Badge></dd>
                            </div>
                            {canViewClinical ? (
                                <>
                                    <div className="flex justify-between">
                                        <dt className="text-on-surface-variant">Diagnose</dt>
                                        <dd className="text-on-surface">{akte.diagnose || "–"}</dd>
                                    </div>
                                    <div className="flex justify-between">
                                        <dt className="text-on-surface-variant">Befunde (Freitext)</dt>
                                        <dd className="text-on-surface text-right max-w-[60%]">{akte.befunde || "–"}</dd>
                                    </div>
                                </>
                            ) : (
                                <p className="text-caption text-on-surface-variant pt-1">
                                    Klinische Details sind für Ihre Rolle nicht sichtbar.
                                </p>
                            )}
                        </dl>
                    ) : (
                        <p className="text-body text-on-surface-variant">Keine Akte vorhanden</p>
                    )}
                </Card>
            </div>

            {canViewClinical && akte && (
                <>
                    <Card>
                        <CardHeader
                            title="Untersuchungen"
                            action={<Button size="sm" onClick={() => setShowUntersuchung(true)}>+ Untersuchung</Button>}
                        />
                        {untersuchungen.length === 0 ? (
                            <p className="text-body text-on-surface-variant">Keine Untersuchungen.</p>
                        ) : (
                            <ul className="space-y-2 text-body">
                                {untersuchungen.map((u) => (
                                    <li key={u.id} className="border border-surface-container rounded-lg p-3">
                                        <div className="text-caption text-on-surface-variant">{formatDateTime(u.created_at)}</div>
                                        {u.beschwerden && <div><span className="text-on-surface-variant">Beschwerden: </span>{u.beschwerden}</div>}
                                        {u.diagnose && <div><span className="text-on-surface-variant">Diagnose: </span>{u.diagnose}</div>}
                                        {u.ergebnisse && <div><span className="text-on-surface-variant">Ergebnisse: </span>{u.ergebnisse}</div>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card>
                        <CardHeader
                            title="Behandlungen"
                            action={<Button size="sm" onClick={() => setShowBehandlung(true)}>+ Behandlung</Button>}
                        />
                        {behandlungen.length === 0 ? (
                            <p className="text-body text-on-surface-variant">Keine Behandlungen.</p>
                        ) : (
                            <ul className="space-y-2 text-body">
                                {behandlungen.map((b) => (
                                    <li key={b.id} className="border border-surface-container rounded-lg p-3">
                                        <div className="flex justify-between">
                                            <span className="font-medium text-on-primary">{b.art}</span>
                                            <span className="text-caption text-on-surface-variant">{formatDateTime(b.created_at)}</span>
                                        </div>
                                        {b.beschreibung && <p className="mt-1">{b.beschreibung}</p>}
                                        {(b.zaehne || b.material) && (
                                            <p className="text-caption text-on-surface-variant">
                                                {b.zaehne ? `Zähne: ${b.zaehne}` : ""}
                                                {b.zaehne && b.material ? " · " : ""}
                                                {b.material ? `Material: ${b.material}` : ""}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card>
                        <CardHeader
                            title="Anamnesebogen (JSON)"
                            action={<Button size="sm" onClick={handleSaveAnamnese}>Speichern</Button>}
                        />
                        <label className="flex items-center gap-2 text-body mb-2">
                            <input
                                type="checkbox"
                                checked={anamneseSign}
                                onChange={(e) => setAnamneseSign(e.target.checked)}
                            />
                            Patientenunterschrift vorhanden
                        </label>
                        <Textarea
                            id="anamnese-json"
                            label="Antworten (JSON)"
                            value={anamneseJson}
                            onChange={(e) => setAnamneseJson(e.target.value)}
                            className="font-mono text-caption min-h-[120px]"
                        />
                    </Card>
                </>
            )}

            {akte && (
                <Card>
                    <CardHeader
                        title="Zahnbefunde"
                        action={canViewClinical ? <Button size="sm" onClick={() => setShowBefund(true)}>+ Befund</Button> : undefined}
                    />
                    {!canViewClinical ? (
                        <p className="text-body text-on-surface-variant">Zahnbefunde sind nur für die Rolle Arzt sichtbar.</p>
                    ) : befunde.length === 0 ? (
                        <p className="text-body text-on-surface-variant">Keine Zahnbefunde vorhanden.</p>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                            {befunde.map((b) => (
                                <div
                                    key={b.id}
                                    className="bg-surface-container rounded-lg p-2 text-center hover:bg-surface-overlay transition-colors"
                                    title={b.notizen || ""}
                                >
                                    <div className="text-title text-primary">{b.zahn_nummer}</div>
                                    <div className="text-caption text-on-surface-variant truncate">{b.befund}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            )}

            <Dialog
                open={showBefund}
                onClose={() => setShowBefund(false)}
                title="Neuer Zahnbefund"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowBefund(false)}>Abbrechen</Button>
                        <Button onClick={handleCreateBefund} disabled={!befundForm.zahnnummer || !befundForm.befund}>Erstellen</Button>
                    </>
                }
            >
                <Input id="zahnnummer" type="number" label="Zahnnummer (FDI / System 1–32)" value={befundForm.zahnnummer} onChange={(e) => setBefundForm({ ...befundForm, zahnnummer: e.target.value })} />
                <Input id="befund" label="Befund" value={befundForm.befund} onChange={(e) => setBefundForm({ ...befundForm, befund: e.target.value })} />
                <Textarea id="behandlung" label="Notizen / Kurztext" value={befundForm.behandlung} onChange={(e) => setBefundForm({ ...befundForm, behandlung: e.target.value })} />
            </Dialog>

            <Dialog
                open={showBehandlung}
                onClose={() => setShowBehandlung(false)}
                title="Behandlung dokumentieren"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowBehandlung(false)}>Abbrechen</Button>
                        <Button onClick={handleCreateBehandlung} disabled={!behandlungForm.art.trim()}>Speichern</Button>
                    </>
                }
            >
                <Input id="bh-art" label="Art / Code (z. B. BEMA)" value={behandlungForm.art} onChange={(e) => setBehandlungForm({ ...behandlungForm, art: e.target.value })} />
                <Textarea id="bh-desc" label="Beschreibung" value={behandlungForm.beschreibung} onChange={(e) => setBehandlungForm({ ...behandlungForm, beschreibung: e.target.value })} />
                <Input id="bh-zahn" label="Zähne (optional)" value={behandlungForm.zaehne} onChange={(e) => setBehandlungForm({ ...behandlungForm, zaehne: e.target.value })} />
                <Input id="bh-mat" label="Material (optional)" value={behandlungForm.material} onChange={(e) => setBehandlungForm({ ...behandlungForm, material: e.target.value })} />
                <Textarea id="bh-notes" label="Notizen" value={behandlungForm.notizen} onChange={(e) => setBehandlungForm({ ...behandlungForm, notizen: e.target.value })} />
            </Dialog>

            <Dialog
                open={showUntersuchung}
                onClose={() => setShowUntersuchung(false)}
                title="Untersuchung"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowUntersuchung(false)}>Abbrechen</Button>
                        <Button onClick={handleCreateUntersuchung}>Speichern</Button>
                    </>
                }
            >
                <Textarea id="u-bes" label="Beschwerden" value={untersuchungForm.beschwerden} onChange={(e) => setUntersuchungForm({ ...untersuchungForm, beschwerden: e.target.value })} />
                <Textarea id="u-erg" label="Ergebnisse" value={untersuchungForm.ergebnisse} onChange={(e) => setUntersuchungForm({ ...untersuchungForm, ergebnisse: e.target.value })} />
                <Textarea id="u-dia" label="Diagnose" value={untersuchungForm.diagnose} onChange={(e) => setUntersuchungForm({ ...untersuchungForm, diagnose: e.target.value })} />
            </Dialog>
        </div>
    );
}
