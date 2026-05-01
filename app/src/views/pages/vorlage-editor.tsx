import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import {
    listDokumentVorlagen,
    createDokumentVorlage,
    updateDokumentVorlage,
    deleteDokumentVorlage,
} from "../../controllers/praxis.controller";
import { useFormDirtyStore } from "../../models/store/form-dirty-store";
import { errorMessage } from "../../lib/utils";
import { Button } from "../components/ui/button";
import { Input, Select, Textarea } from "../components/ui/input";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { MEDIKAMENT_SUGGESTIONS } from "@/lib/medikamente";
import type { DokumentVorlage } from "../../models/types";

const MEDIKAMENTE =
    MEDIKAMENT_SUGGESTIONS.length > 0
        ? MEDIKAMENT_SUGGESTIONS.map((s) => ({ value: s.label, label: s.label }))
        : [{ value: "", label: "— Keine Vorschlagsliste —" }];

const DEFAULT_MEDIKAMENT_VALUE = MEDIKAMENTE[0]?.value ?? "";

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

export type VorlageEditorPanelProps =
    | {
          editingId: null;
          newTemplateKind: "REZEPT" | "ATTEST";
          canWrite: boolean;
          onClose: () => void;
          onSaved: () => void;
      }
    | {
          editingId: string;
          canWrite: boolean;
          onClose: () => void;
          onSaved: () => void;
      };

/**
 * Eingebetteter Editor für Rezept-/Attest-Vorlagen (Rechte Spalte auf „Rezepte und Atteste vordefinieren“).
 * Keine eigene Seite — entfernte Route leitet per `VorlageEditorPage` mit Query-Parametern um.
 */
export function VorlageEditorPanel(props: VorlageEditorPanelProps) {
    const { canWrite, onClose, onSaved } = props;
    const editingId = props.editingId;
    const newTemplateKind = "newTemplateKind" in props ? props.newTemplateKind : null;
    const toast = useToastStore((s) => s.add);
    const setGlobalDirty = useFormDirtyStore((s) => s.setDirty);
    const [loading, setLoading] = useState(true);
    const [kind, setKind] = useState<"REZEPT" | "ATTEST">("REZEPT");
    const [titel, setTitel] = useState("");
    const [rezeptItems, setRezeptItems] = useState<RezeptItem[]>([]);
    const [medPick, setMedPick] = useState(DEFAULT_MEDIKAMENT_VALUE);
    const [dosierung, setDosierung] = useState("");
    const [beschreibung, setBeschreibung] = useState("");
    const [krankheiten, setKrankheiten] = useState(DEFAULT_KRANKHEIT);
    const [tageAnzahl, setTageAnzahl] = useState("");
    const [einschraenkung, setEinschraenkung] = useState("");
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [lineRemoveIdx, setLineRemoveIdx] = useState<number | null>(null);
    /** Gespeicherte Form-Signatur nach Laden (null = Laden / keine Basis). */
    const [baselineSig, setBaselineSig] = useState<string | null>(null);

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
                const rawTage = p.tage_anzahl;
                setTageAnzahl(
                    rawTage === undefined || rawTage === null ? "" : String(rawTage),
                );
                setEinschraenkung(String(p.einschraenkung ?? ""));
            }
        } catch {
            setRezeptItems([]);
            setKrankheiten(DEFAULT_KRANKHEIT);
            setTageAnzahl("");
            setEinschraenkung("");
        }
        setMedPick(DEFAULT_MEDIKAMENT_VALUE);
        setDosierung("");
        setBeschreibung("");
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            if (editingId === null) {
                setKind(newTemplateKind ?? "REZEPT");
                setTitel("");
                setRezeptItems([]);
                setDosierung("");
                setBeschreibung("");
                setTageAnzahl("");
                setEinschraenkung("");
                setKrankheiten(DEFAULT_KRANKHEIT);
                setMedPick(DEFAULT_MEDIKAMENT_VALUE);
                return;
            }
            const all = await listDokumentVorlagen();
            const row = all.find((r) => r.id === editingId);
            if (!row) {
                toast("Vorlage nicht gefunden", "error");
                onClose();
                return;
            }
            applyRow(row);
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        } finally {
            setLoading(false);
        }
    }, [editingId, newTemplateKind, applyRow, onClose, toast]);

    useEffect(() => {
        void load();
    }, [load]);

    useLayoutEffect(() => {
        if (loading) setBaselineSig(null);
    }, [loading]);

    const currentSig = useMemo(
        () =>
            JSON.stringify({
                kind,
                titel,
                rezeptItems,
                krankheiten,
                tageAnzahl,
                einschraenkung,
            }),
        [kind, titel, rezeptItems, krankheiten, tageAnzahl, einschraenkung],
    );

    useLayoutEffect(() => {
        if (!loading) {
            setBaselineSig((b) => (b === null ? currentSig : b));
        }
    }, [loading, currentSig]);

    const isDirty = !loading && baselineSig !== null && currentSig !== baselineSig;

    useEffect(() => {
        setGlobalDirty(isDirty);
        return () => setGlobalDirty(false);
    }, [isDirty, setGlobalDirty]);

    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (useFormDirtyStore.getState().dirty) e.preventDefault();
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    const addRezeptLine = () => {
        const med = medPick.trim();
        if (!med) return;
        if (!dosierung.trim()) {
            toast("Bitte Dosierung angeben (z. B. 1-0-1)", "error");
            return;
        }
        const key = med.toLowerCase();
        if (rezeptItems.some((it) => it.medikament.trim().toLowerCase() === key)) {
            toast("Dieses Medikament ist bereits in der Liste", "error");
            return;
        }
        setRezeptItems((prev) => [
            ...prev,
            { medikament: med, dosierung: dosierung.trim(), beschreibung: beschreibung.trim() },
        ]);
        setDosierung("");
        setBeschreibung("");
    };

    const removeRezeptLineConfirmed = () => {
        if (lineRemoveIdx === null) return;
        const idx = lineRemoveIdx;
        setLineRemoveIdx(null);
        setRezeptItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const buildPayload = (): Record<string, unknown> => {
        if (kind === "REZEPT") return { items: rezeptItems };
        const n = Number.parseInt(tageAnzahl.trim(), 10);
        return {
            krankheiten,
            tage_anzahl: Number.isFinite(n) ? n : tageAnzahl.trim(),
            einschraenkung: einschraenkung.trim(),
        };
    };

    const save = async () => {
        if (!canWrite) return;
        if (!titel.trim()) {
            toast("Bitte Titel eingeben", "error");
            return;
        }
        if (kind === "REZEPT" && rezeptItems.length === 0) {
            toast("Mindestens eine vollständige Medikamentenzeile (Medikament + Dosierung) hinzufügen", "error");
            return;
        }
        if (kind === "ATTEST") {
            const raw = tageAnzahl.trim();
            const n = Number.parseInt(raw, 10);
            if (!raw || !Number.isFinite(n) || n < 1 || n > 366) {
                toast("Anzahl der Tage: bitte eine ganze Zahl zwischen 1 und 366 eingeben", "error");
                return;
            }
        }
        try {
            const payload = buildPayload();
            if (editingId !== null) {
                await updateDokumentVorlage(editingId, { titel: titel.trim(), payload });
                toast("Vorlage gespeichert");
            } else {
                await createDokumentVorlage({ kind, titel: titel.trim(), payload });
                toast("Vorlage angelegt");
            }
            setBaselineSig(currentSig);
            setGlobalDirty(false);
            onSaved();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        }
    };

    const runReset = () => {
        setResetOpen(false);
        void load();
    };

    const removeTemplate = async () => {
        if (editingId === null) return;
        try {
            await deleteDokumentVorlage(editingId);
            toast("Vorlage gelöscht");
            setDeleteOpen(false);
            setBaselineSig(null);
            setGlobalDirty(false);
            onSaved();
            onClose();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        }
    };

    if (loading) {
        return <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14 }}>Editor wird geladen…</p>;
    }

    return (
        <div className="vorlage-editor-panel">
            <ConfirmDialog
                open={deleteOpen}
                title="Löschen bestätigen:"
                message="Möchten Sie diese Vorlage wirklich löschen?"
                confirmLabel="Ja, löschen"
                danger
                onConfirm={() => void removeTemplate()}
                onClose={() => setDeleteOpen(false)}
            />
            <ConfirmDialog
                open={resetOpen}
                title="Zurücksetzen"
                message="Alle Bearbeitungen an dieser Vorlage verwerfen und den zuletzt gespeicherten Stand neu laden?"
                confirmLabel="Zurücksetzen"
                onConfirm={() => runReset()}
                onClose={() => setResetOpen(false)}
            />
            <ConfirmDialog
                open={lineRemoveIdx !== null}
                title="Zeile entfernen"
                message="Diese Medikamentenzeile aus der Vorlage entfernen?"
                confirmLabel="Entfernen"
                danger
                onConfirm={() => removeRezeptLineConfirmed()}
                onClose={() => setLineRemoveIdx(null)}
            />

            <Input label="Titel" value={titel} onChange={(e) => setTitel(e.target.value)} disabled={!canWrite} />

            {kind === "REZEPT" ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginTop: 12 }}>
                        <Select
                            label="Medikament"
                            value={medPick}
                            onChange={(e) => setMedPick(e.target.value)}
                            options={MEDIKAMENTE}
                            disabled={!canWrite}
                        />
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
                        {rezeptItems.length === 0 ? (
                            <p style={{ color: "var(--fg-3)", fontSize: 13 }}>Noch keine Medikamente.</p>
                        ) : (
                            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                                {rezeptItems.map((it, idx) => (
                                    <li
                                        key={`${it.medikament}-${idx}`}
                                        className="row"
                                        style={{ justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}
                                    >
                                        <span style={{ fontSize: 13 }}>
                                            {it.medikament} — {it.dosierung || "—"}
                                        </span>
                                        {canWrite ? (
                                            <button type="button" className="btn btn-ghost" onClick={() => setLineRemoveIdx(idx)}>
                                                Entfernen
                                            </button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <datalist id="ve-krankheiten-suggestions-embedded">
                        {KRANKHEITEN_SUGGESTIONS.map((k) => (
                            <option key={k} value={k} />
                        ))}
                    </datalist>
                    <Input
                        label="Krankheiten"
                        list="ve-krankheiten-suggestions-embedded"
                        value={krankheiten}
                        onChange={(e) => setKrankheiten(e.target.value)}
                        disabled={!canWrite}
                        placeholder="Frei eingeben oder aus Vorschlägen wählen"
                    />
                    <Input
                        label="Anzahl der Tage"
                        type="number"
                        min={1}
                        max={366}
                        inputMode="numeric"
                        value={tageAnzahl}
                        onChange={(e) => setTageAnzahl(e.target.value)}
                        disabled={!canWrite}
                    />
                    <Textarea label="Empfohlene Tätigkeitseinschränkung" value={einschraenkung} onChange={(e) => setEinschraenkung(e.target.value)} rows={4} disabled={!canWrite} />
                </>
            )}

            {canWrite ? (
                <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                    {editingId !== null ? (
                        <Button type="button" variant="danger" onClick={() => setDeleteOpen(true)}>
                            Löschen
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            if (isDirty) setResetOpen(true);
                            else void load();
                        }}
                    >
                        Zurücksetzen
                    </Button>
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Schließen
                    </Button>
                    <Button type="button" onClick={() => void save()}>
                        {kind === "REZEPT" ? "Rezept speichern" : "Attest speichern"}
                    </Button>
                </div>
            ) : (
                <p style={{ color: "var(--fg-3)", marginTop: 16 }}>Nur Lesen.</p>
            )}
        </div>
    );
}

/** Rückwärtskompatibel: alte `/verwaltung/vorlagen/editor` URLs → listenbasiert mit Query-Parametern. */
export function VorlageEditorPage() {
    const { id } = useParams<{ id: string }>();
    const [sp] = useSearchParams();
    const kind = sp.get("kind");
    if (id) {
        return <Navigate to={`/verwaltung/vorlagen?bearbeiten=${encodeURIComponent(id)}`} replace />;
    }
    if (kind?.toLowerCase() === "attest") {
        return <Navigate to="/verwaltung/vorlagen?neu=attest" replace />;
    }
    return <Navigate to="/verwaltung/vorlagen?neu=rezept" replace />;
}
