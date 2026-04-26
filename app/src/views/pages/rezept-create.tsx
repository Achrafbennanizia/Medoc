import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getPatient } from "../../controllers/patient.controller";
import { listDokumentVorlagen } from "../../controllers/praxis.controller";
import { createRezept } from "../../controllers/rezept.controller";
import { errorMessage } from "../../lib/utils";
import type { DokumentVorlage } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { ChevronLeftIcon } from "@/lib/icons";
import {
    MEDIKAMENT_SUGGESTIONS,
    findSuggestion as findMedSuggestion,
    emptyRezeptLine,
    parseRezeptVorlagePayload,
    vorlageItemsToLines,
    type RezeptLine,
} from "@/lib/medikamente";
import type { Patient } from "../../models/types";

function validateRezeptLine(line: RezeptLine): string | null {
    if (!line.medikament.trim()) return "Bitte Medikament wählen oder eingeben.";
    if (!line.dosierung.trim()) return "Bitte Dosierung angeben.";
    if (!line.dauer.trim()) return "Bitte Dauer angeben.";
    return null;
}

export function RezeptCreatePage() {
    const { id: patientId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const session = useAuthStore((s) => s.session);
    const toast = useToastStore((s) => s.add);

    const [patient, setPatient] = useState<Patient | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadingPatient, setLoadingPatient] = useState(true);

    const [vorlagen, setVorlagen] = useState<DokumentVorlage[]>([]);
    const [vorlageSelect, setVorlageSelect] = useState("");

    const [draft, setDraft] = useState<RezeptLine>(emptyRezeptLine);
    const [draftError, setDraftError] = useState<string | null>(null);
    const [lines, setLines] = useState<RezeptLine[]>([]);
    const [shared, setShared] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadPatient = useCallback(async () => {
        if (!patientId) return;
        setLoadingPatient(true);
        setLoadError(null);
        try {
            const p = await getPatient(patientId);
            setPatient(p);
        } catch (e) {
            setLoadError(errorMessage(e));
            setPatient(null);
        } finally {
            setLoadingPatient(false);
        }
    }, [patientId]);

    useEffect(() => {
        void loadPatient();
    }, [loadPatient]);

    useEffect(() => {
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
    }, []);

    const applyVorlage = useCallback(
        (vorlageId: string) => {
            if (!vorlageId) return;
            const v = vorlagen.find((x) => x.id === vorlageId);
            if (!v) return;
            const items = parseRezeptVorlagePayload(v.payload);
            const newLines = vorlageItemsToLines(items);
            if (newLines.length === 0) {
                toast("Vorlage enthält keine Medikamente.", "error");
                return;
            }
            setVorlageSelect(vorlageId);
            setLines((prev) => [...prev, ...newLines]);
            setDraftError(null);
            toast(`Vorlage „${v.titel}“ eingefügt (${newLines.length} Zeile${newLines.length === 1 ? "" : "n"}).`);
        },
        [vorlagen, toast],
    );

    useEffect(() => {
        const q = searchParams.get("vorlage");
        if (!q || vorlagen.length === 0) return;
        const exists = vorlagen.some((v) => v.id === q);
        if (!exists) return;
        applyVorlage(q);
        navigate({ search: "" }, { replace: true });
    }, [searchParams, vorlagen, applyVorlage, navigate]);

    const vorlageOptions = useMemo(
        () => [{ value: "", label: "— Vorlage auswählen —" }, ...vorlagen.map((v) => ({ value: v.id, label: v.titel }))],
        [vorlagen],
    );

    const vorlagenPreview = useMemo(
        () =>
            vorlagen.map((v) => {
                const n = parseRezeptVorlagePayload(v.payload).filter(
                    (it) => it && typeof it.medikament === "string" && it.medikament.trim().length > 0,
                ).length;
                return { id: v.id, titel: v.titel, n };
            }),
        [vorlagen],
    );

    const pickMed = (label: string) => {
        const sugg = findMedSuggestion(label);
        setDraft((prev) => ({
            ...prev,
            medikament: label,
            wirkstoff: prev.wirkstoff || sugg?.wirkstoff || "",
            dosierung: prev.dosierung || sugg?.dosierung || "",
        }));
    };

    const addLine = () => {
        const err = validateRezeptLine(draft);
        if (err) {
            setDraftError(err);
            return;
        }
        setLines((prev) => [...prev, { ...draft }]);
        setDraft(emptyRezeptLine());
        setDraftError(null);
    };

    const removeLine = (idx: number) => {
        setLines((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (!patientId || !session) return;
        const queue: RezeptLine[] = [...lines];
        if (validateRezeptLine(draft) === null) queue.push({ ...draft });
        if (queue.length === 0) {
            setDraftError("Mindestens eine Medikamentenzeile hinzufügen.");
            return;
        }
        setCreating(true);
        setError(null);
        let ok = 0;
        try {
            for (const line of queue) {
                const merged = [line.hinweise, shared].filter((s) => s.trim()).join(" · ");
                await createRezept({
                    patient_id: patientId,
                    arzt_id: session.user_id,
                    medikament: line.medikament.trim(),
                    wirkstoff: line.wirkstoff.trim() || null,
                    dosierung: line.dosierung.trim(),
                    dauer: line.dauer.trim(),
                    hinweise: merged.trim() || null,
                });
                ok += 1;
            }
            toast(`${ok} Rezept${ok === 1 ? "" : "e"} erstellt`, "success");
            navigate(`/patienten/${patientId}#rezept`);
        } catch (e) {
            setError(
                `${ok > 0 ? `${ok} angelegt, dann ` : ""}${errorMessage(e)}`,
            );
        } finally {
            setCreating(false);
        }
    };

    if (!patientId) {
        return (
            <div className="animate-fade-in p-4">
                <p className="text-body text-on-surface-variant">Kein Patient angegeben.</p>
            </div>
        );
    }

    if (loadingPatient) return <PageLoading label="Patient wird geladen…" />;
    if (loadError || !patient) {
        return <PageLoadError message={loadError ?? "Patient nicht gefunden."} onRetry={() => void loadPatient()} />;
    }

    const nLines = lines.length + (validateRezeptLine(draft) === null ? 1 : 0);
    const cannotSave = nLines === 0 || creating;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Button variant="secondary" onClick={() => navigate(`/patienten/${patientId}#rezept`)}>
                    <ChevronLeftIcon />Zurück zur Akte
                </Button>
                <div>
                    <div className="page-sub" style={{ fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {patient.name}
                    </div>
                    <h1 className="page-title" style={{ margin: 0 }}>Neues Rezept</h1>
                </div>
            </div>

            <div style={{ maxWidth: 920 }}>
            <Card>
                    <CardHeader
                        title="Kombinationsrezept"
                        subtitle="Vorlagen fügen fertige Zeilen ein. Manuelle Zeilen unten ergänzen — jede Zeile wird als eigenes Rezept gespeichert."
                    />
                    <div style={{ padding: "0 16px 16px" }}>
                        {error ? (
                            <p style={{
                                color: "var(--red)", fontSize: 12.5, margin: "0 0 12px",
                                padding: "8px 12px", background: "var(--red-soft)", borderRadius: 8,
                            }}>
                                {error}
                            </p>
                        ) : null}

                        <div className="rezept-vorlagen-panel">
                            <div style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--fg-3)", marginBottom: 10 }}>
                                Praxis-Vorlagen
                            </div>
                            {vorlagen.length > 0 ? (
                                <>
                                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end" style={{ marginBottom: 10 }}>
                                        <div className="flex-1 min-w-0">
                                            <Select
                                                id="rc-vorlage"
                                                label="Vorlage"
                                                value={vorlageSelect}
                                                options={vorlageOptions}
                                                onChange={(e) => setVorlageSelect(e.target.value)}
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            disabled={!vorlageSelect}
                                            onClick={() => applyVorlage(vorlageSelect)}
                                        >
                                            In Liste einfügen
                                        </Button>
                                    </div>
                                    <div className="rezept-vorlagen-chips">
                                        {vorlagenPreview.map(({ id, titel, n }) => (
                                            <button
                                                key={id}
                                                type="button"
                                                className="rezept-vorlage-chip"
                                                onClick={() => applyVorlage(id)}
                                                title={n === 0 ? "Vorlage ohne Medikamente" : `${n} Zeile(n) einfügen`}
                                                disabled={n === 0}
                                            >
                                                <span className="rezept-vorlage-chip-title">{titel}</span>
                                                <span className="pill grey" style={{ fontSize: 10.5 }}>{n}×</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}>
                                    Noch keine Vorlagen angelegt — unter{" "}
                                    <button type="button" className="linkish" onClick={() => navigate("/verwaltung/vorlagen")}>
                                        Verwaltung → Vorlagen
                                    </button>{" "}
                                    können Sie z. B. Standard-Schemata hinterlegen. Danach erscheinen sie hier automatisch.
                                </p>
                            )}
                        </div>

                        <datalist id="rc-med-suggestions">
                            {MEDIKAMENT_SUGGESTIONS.map((s) => (
                                <option key={s.label} value={s.label} />
                            ))}
                        </datalist>

                        <div
                            style={{
                                border: "1px solid var(--line)",
                                borderRadius: 10,
                                padding: 12,
                                marginBottom: 12,
                                background: "rgba(0,0,0,0.02)",
                            }}
                        >
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Neue Zeile</div>
                            {draftError ? (
                                <p style={{ color: "var(--red)", fontSize: 12, margin: "0 0 8px" }}>{draftError}</p>
                            ) : null}
                            <Input
                                id="rc-med"
                                label="Medikament *"
                                list="rc-med-suggestions"
                                value={draft.medikament}
                                onChange={(e) => pickMed(e.target.value)}
                                placeholder="z. B. Ibuprofen 600 mg"
                            />
                            <Input
                                id="rc-wirk"
                                label="Wirkstoff"
                                value={draft.wirkstoff}
                                onChange={(e) => setDraft({ ...draft, wirkstoff: e.target.value })}
                            />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Input
                                    id="rc-dos"
                                    label="Dosierung *"
                                    value={draft.dosierung}
                                    onChange={(e) => setDraft({ ...draft, dosierung: e.target.value })}
                                    placeholder="z. B. 1-0-1"
                                />
                                <Input
                                    id="rc-dauer"
                                    label="Dauer *"
                                    value={draft.dauer}
                                    onChange={(e) => setDraft({ ...draft, dauer: e.target.value })}
                                    placeholder="z. B. 7 Tage"
                                />
                            </div>
                            <Textarea
                                id="rc-hin"
                                label="Hinweise (Zeile)"
                                rows={2}
                                value={draft.hinweise}
                                onChange={(e) => setDraft({ ...draft, hinweise: e.target.value })}
                            />
                            <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                                <Button type="button" size="sm" variant="secondary" onClick={addLine}>
                                    + Zeile zur Liste
                                </Button>
                            </div>
                        </div>

                        <Textarea
                            id="rc-shared"
                            label="Allgemeine Hinweise (für alle Zeilen)"
                            rows={2}
                            value={shared}
                            onChange={(e) => setShared(e.target.value)}
                        />

                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                                Zeilen ({lines.length})
                            </div>
                            {lines.length === 0 ? (
                                <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0 }}>
                                    Noch keine Zeilen — eine Vorlage einfügen oder unten ausfüllen und „Zeile zur Liste“ wählen.
                                </p>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table className="tbl">
                                        <thead>
                                            <tr>
                                                <th>Medikament</th>
                                                <th>Dosierung</th>
                                                <th>Dauer</th>
                                                <th style={{ width: 100 }} />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lines.map((ln, i) => (
                                                <tr key={`${ln.medikament}-${i}`}>
                                                    <td style={{ fontWeight: 600 }}>{ln.medikament}</td>
                                                    <td>{ln.dosierung}</td>
                                                    <td>{ln.dauer}</td>
                                                    <td>
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => removeLine(i)}>
                                                            Entfernen
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
                            <p style={{ margin: 0, fontSize: 12, color: "var(--fg-3)" }}>
                                Nach dem Speichern: Akte · Tab „Rezepte &amp; Atteste“.
                            </p>
                            <div className="row" style={{ gap: 8 }}>
                                <Button variant="ghost" onClick={() => navigate(`/patienten/${patientId}#rezept`)} disabled={creating}>
                                    Abbrechen
                                </Button>
                                <Button onClick={() => void handleSave()} loading={creating} disabled={cannotSave}>
                                    {creating
                                        ? "Wird gespeichert…"
                                        : nLines > 1
                                            ? `${nLines} Rezepte erstellen`
                                            : "Rezept erstellen"}
                                </Button>
                            </div>
                        </div>
                    </div>
            </Card>
            </div>
        </div>
    );
}
