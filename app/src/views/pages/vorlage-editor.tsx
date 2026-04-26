import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    listDokumentVorlagen,
    createDokumentVorlage,
    updateDokumentVorlage,
    deleteDokumentVorlage,
} from "../../controllers/praxis.controller";
import { allowed, parseRole } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { DokumentVorlage } from "../../models/types";
import { errorMessage } from "../../lib/utils";
import { Button } from "../components/ui/button";
import { Input, Select, Textarea } from "../components/ui/input";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import { MEDIKAMENT_SUGGESTIONS } from "@/lib/medikamente";

const MEDIKAMENTE = MEDIKAMENT_SUGGESTIONS.map((s) => ({ value: s.label, label: s.label }));

/**
 * Vorschlagsliste für das Feld „Krankheiten“ in der Attest-Vorlage. Die
 * Eingabe selbst ist freier Text (ICD-10-Realität: tausende Diagnosen),
 * diese Liste dient nur als datalist-Autocomplete.
 */
const KRANKHEITEN_SUGGESTIONS: string[] = [
    "grippaler Infekt",
    "Rückenschmerzen",
    "Migräne",
    "Zahnbehandlung",
    "Akute Pulpitis",
    "Parodontitis",
    "Wundheilung nach Extraktion",
    "Kieferorthopädische Behandlung",
    "Sonstiges",
];

const DEFAULT_KRANKHEIT = KRANKHEITEN_SUGGESTIONS[0]!;

type RezeptItem = { medikament: string; dosierung: string; beschreibung: string };

export function VorlageEditorPage() {
    const { id } = useParams<{ id: string }>();
    const [search] = useSearchParams();
    const kindQuery = search.get("kind");
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canWrite = role ? allowed("personal.write", role) : false;

    const [loading, setLoading] = useState(true);
    const [kind, setKind] = useState<"REZEPT" | "ATTEST">("REZEPT");
    const [titel, setTitel] = useState("");
    const [rezeptItems, setRezeptItems] = useState<RezeptItem[]>([]);
    const [medPick, setMedPick] = useState(MEDIKAMENTE[0]!.value);
    const [dosierung, setDosierung] = useState("");
    const [beschreibung, setBeschreibung] = useState("");
    const [krankheiten, setKrankheiten] = useState(DEFAULT_KRANKHEIT);
    const [tageAnzahl, setTageAnzahl] = useState("");
    const [einschraenkung, setEinschraenkung] = useState("");
    const [deleteOpen, setDeleteOpen] = useState(false);

    const applyRow = useCallback((row: DokumentVorlage) => {
        setKind(row.kind);
        setTitel(row.titel);
        try {
            const p = JSON.parse(row.payload) as Record<string, unknown>;
            if (row.kind === "REZEPT") {
                const items = p.items as RezeptItem[] | undefined;
                setRezeptItems(Array.isArray(items) ? items : []);
                setKrankheiten(DEFAULT_KRANKHEIT);
                setTageAnzahl("");
                setEinschraenkung("");
            } else {
                setRezeptItems([]);
                setKrankheiten(String(p.krankheiten || DEFAULT_KRANKHEIT));
                setTageAnzahl(String(p.tage_anzahl ?? ""));
                setEinschraenkung(String(p.einschraenkung ?? ""));
            }
        } catch {
            setRezeptItems([]);
            setKrankheiten(DEFAULT_KRANKHEIT);
            setTageAnzahl("");
            setEinschraenkung("");
        }
        setMedPick(MEDIKAMENTE[0]!.value);
        setDosierung("");
        setBeschreibung("");
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (!id) {
                const k = kindQuery?.toLowerCase();
                setKind(k === "attest" ? "ATTEST" : "REZEPT");
                setTitel("");
                setRezeptItems([]);
                setDosierung("");
                setBeschreibung("");
                setTageAnzahl("");
                setEinschraenkung("");
                setKrankheiten(DEFAULT_KRANKHEIT);
                setMedPick(MEDIKAMENTE[0]!.value);
                setLoading(false);
                return;
            }
            const all = await listDokumentVorlagen();
            const row = all.find((r) => r.id === id);
            if (!row) {
                toast("Vorlage nicht gefunden", "error");
                navigate("/verwaltung/vorlagen");
                return;
            }
            applyRow(row);
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
            navigate("/verwaltung/vorlagen");
        } finally {
            setLoading(false);
        }
    }, [id, navigate, kindQuery, toast, applyRow]);

    useEffect(() => {
        void load();
    }, [load]);

    const addRezeptLine = () => {
        if (!medPick.trim()) return;
        setRezeptItems((prev) => [...prev, { medikament: medPick, dosierung: dosierung.trim(), beschreibung: beschreibung.trim() }]);
        setDosierung("");
        setBeschreibung("");
    };

    const removeRezeptLine = (idx: number) => {
        setRezeptItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const buildPayload = (): Record<string, unknown> => {
        if (kind === "REZEPT") return { items: rezeptItems };
        return { krankheiten, tage_anzahl: tageAnzahl.trim(), einschraenkung: einschraenkung.trim() };
    };

    const save = async () => {
        if (!canWrite) return;
        if (!titel.trim()) {
            toast("Bitte Titel eingeben", "error");
            return;
        }
        if (kind === "REZEPT" && rezeptItems.length === 0) {
            toast("Mindestens eine Medikamentenzeile hinzufügen", "error");
            return;
        }
        if (kind === "ATTEST" && !tageAnzahl.trim()) {
            toast("Bitte Anzahl der Tage angeben", "error");
            return;
        }
        try {
            const payload = buildPayload();
            if (id) {
                await updateDokumentVorlage(id, { titel: titel.trim(), payload });
                toast("Vorlage gespeichert");
            } else {
                await createDokumentVorlage({ kind, titel: titel.trim(), payload });
                toast("Vorlage angelegt");
            }
            navigate("/verwaltung/vorlagen");
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        }
    };

    const resetForm = () => {
        void load();
    };

    const removeTemplate = async () => {
        if (!id) return;
        try {
            await deleteDokumentVorlage(id);
            toast("Vorlage gelöscht");
            navigate("/verwaltung/vorlagen");
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        }
    };

    if (loading) return <PageLoading label="Editor wird geladen…" />;

    const titleBar = kind === "REZEPT" ? (id ? "Rezept-Vorlage bearbeiten" : "Neues Rezept") : id ? "Attest-Vorlage bearbeiten" : "Neues Attest";

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <ConfirmDialog
                open={deleteOpen}
                title="Löschen bestätigen:"
                message="Möchten Sie diese Vorlage wirklich löschen?"
                confirmLabel="Ja, löschen"
                danger
                onConfirm={() => void removeTemplate()}
                onClose={() => setDeleteOpen(false)}
            />

            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <VerwaltungBackButton />
                <h1 className="page-title" style={{ margin: 0 }}>{titleBar}</h1>
            </div>

            <div className="card card-pad" style={{ maxWidth: 720 }}>
                <Input label="Titel" value={titel} onChange={(e) => setTitel(e.target.value)} disabled={!canWrite} />

                {kind === "REZEPT" ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginTop: 12 }}>
                            <Select label="Medikament" value={medPick} onChange={(e) => setMedPick(e.target.value)} options={MEDIKAMENTE} disabled={!canWrite} />
                            <Input label="Dosierung" value={dosierung} onChange={(e) => setDosierung(e.target.value)} disabled={!canWrite} />
                        </div>
                        <Textarea label="Beschreibung" value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} rows={2} disabled={!canWrite} />
                        {canWrite ? (
                            <Button type="button" variant="secondary" style={{ marginTop: 8 }} onClick={addRezeptLine}>
                                Hinzufügen
                            </Button>
                        ) : null}
                        <div style={{ marginTop: 16, border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Zeilen</div>
                            {rezeptItems.length === 0 ? <p style={{ color: "var(--fg-3)", fontSize: 13 }}>Noch keine Medikamente.</p> : (
                                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                    {rezeptItems.map((it, idx) => (
                                        <li key={`${it.medikament}-${idx}`} className="row" style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                                            <span style={{ fontSize: 13 }}>{it.medikament} — {it.dosierung || "—"}</span>
                                            {canWrite ? (
                                                <button type="button" className="btn btn-ghost" onClick={() => removeRezeptLine(idx)}>Entfernen</button>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <datalist id="ve-krankheiten-suggestions">
                            {KRANKHEITEN_SUGGESTIONS.map((k) => (
                                <option key={k} value={k} />
                            ))}
                        </datalist>
                        <Input
                            label="Krankheiten"
                            list="ve-krankheiten-suggestions"
                            value={krankheiten}
                            onChange={(e) => setKrankheiten(e.target.value)}
                            disabled={!canWrite}
                            placeholder="Frei eingeben oder aus Vorschlägen wählen"
                        />
                        <Input label="Anzahl der Tage" value={tageAnzahl} onChange={(e) => setTageAnzahl(e.target.value)} disabled={!canWrite} />
                        <Textarea label="Empfohlene Tätigkeitseinschränkung" value={einschraenkung} onChange={(e) => setEinschraenkung(e.target.value)} rows={4} disabled={!canWrite} />
                    </>
                )}

                {canWrite ? (
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                        {id ? <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>Löschen</Button> : null}
                        <Button type="button" variant="ghost" onClick={resetForm}>zurücksetzen</Button>
                        <Button type="button" onClick={() => void save()}>{kind === "REZEPT" ? "Rezept speichern" : "Attest speichern"}</Button>
                    </div>
                ) : (
                    <p style={{ color: "var(--fg-3)", marginTop: 16 }}>Nur Lesen.</p>
                )}
            </div>
        </div>
    );
}
