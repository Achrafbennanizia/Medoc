import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listZahlungen } from "../../controllers/zahlung.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { listProdukte } from "../../controllers/produkt.controller";
import { createBilanzSnapshot } from "../../controllers/bilanz-snapshot.controller";
import { allowed, parseRole } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { Patient, Produkt, Zahlung, ZahlungsStatus } from "../../models/types";
import { errorMessage, formatCurrency, formatDateTime } from "../../lib/utils";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { FormSection } from "../components/ui/form-section";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";

const STEPS = ["Allgemeine Angaben", "Einnahmen", "Verträge / Ausgaben", "Ausgaben", "Bestätigen"];

type VertragDemo = {
    id: string;
    name: string;
    typ: string;
    kosten: number;
    abrechnung: string;
    dauer_von: string;
    dauer_bis: string;
    status: "AKTIV" | "GEKUENDIGT";
};

const DEMO_VERTRAEGE: VertragDemo[] = [
    { id: "demo-v1", name: "Praxisraum Bremen-Mitte", typ: "Mietvertrag", kosten: 2400, abrechnung: "Monatlich", dauer_von: "2024-01-01", dauer_bis: "2026-12-31", status: "AKTIV" },
    { id: "demo-v2", name: "Röntgen-Wartungsvertrag", typ: "Service", kosten: 890, abrechnung: "Jährlich", dauer_von: "2025-01-01", dauer_bis: "2025-12-31", status: "GEKUENDIGT" },
    { id: "demo-v3", name: "Softwarelizenz MeDoc", typ: "Lizenz", kosten: 120, abrechnung: "Monatlich", dauer_von: "2026-01-01", dauer_bis: "2026-12-31", status: "AKTIV" },
];

const FALLBACK_PRODUKTE: Produkt[] = [
    { id: "demo-p1", name: "Einmalhandschuhe (Karton)", beschreibung: null, kategorie: "Verbrauch", preis: 42, bestand: 20, mindestbestand: 5, aktiv: true, created_at: "", updated_at: "" },
    { id: "demo-p2", name: "Desinfektionsmittel 5L", beschreibung: null, kategorie: "Hygiene", preis: 38.5, bestand: 8, mindestbestand: 2, aktiv: true, created_at: "", updated_at: "" },
];

function toggleSet<T>(set: Set<T>, key: T): Set<T> {
    const n = new Set(set);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    return n;
}

export function BilanzNeuPage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canReadPatients = role ? allowed("patient.read", role) : false;
    const canBackVerwaltung = role != null && allowed("personal.read", role);

    const [step, setStep] = useState(0);
    const [ack, setAck] = useState(false);
    const [saving, setSaving] = useState(false);

    const [bilanzTyp, setBilanzTyp] = useState("QUARTAL");
    const [bilanzzeitraum, setBilanzzeitraum] = useState("");
    const [org, setOrg] = useState("Praxis");
    const [vorname, setVorname] = useState("");
    const [nachname, setNachname] = useState("");
    const [iban, setIban] = useState("");
    const [bic, setBic] = useState("");
    const [steuernummer, setSteuernummer] = useState("");
    const [finanzamt, setFinanzamt] = useState("");

    const [zahlungen, setZahlungen] = useState<Zahlung[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [produkte, setProdukte] = useState<Produkt[]>([]);
    const [dataStatus, setDataStatus] = useState<"loading" | "ready" | "error">("loading");
    const [dataError, setDataError] = useState<string | null>(null);

    const [filterStatus, setFilterStatus] = useState<"" | ZahlungsStatus>("");
    const [filterMin, setFilterMin] = useState("");
    const [filterMax, setFilterMax] = useState("");
    const [filterSearch, setFilterSearch] = useState("");

    const [selZahlung, setSelZahlung] = useState<Set<string>>(new Set());
    const [selVertrag, setSelVertrag] = useState<Set<string>>(new Set());
    const [selAusgabe, setSelAusgabe] = useState<Set<string>>(new Set());

    const patientName = useMemo(() => {
        const m = new Map<string, string>();
        for (const p of patienten) m.set(p.id, p.name);
        return (id: string) => m.get(id) ?? `Patient ${id.slice(0, 8)}…`;
    }, [patienten]);

    const ausgabeRows = useMemo(() => (produkte.length > 0 ? produkte : FALLBACK_PRODUKTE), [produkte]);

    const reloadBase = useCallback(async () => {
        setDataError(null);
        setDataStatus("loading");
        try {
            const z = await listZahlungen();
            setZahlungen(z);
            if (canReadPatients) {
                try {
                    setPatienten(await listPatienten());
                } catch {
                    setPatienten([]);
                }
            } else {
                setPatienten([]);
            }
            try {
                setProdukte(await listProdukte());
            } catch {
                setProdukte([]);
            }
            setDataStatus("ready");
        } catch (e) {
            setDataError(errorMessage(e));
            setDataStatus("error");
        }
    }, [canReadPatients]);

    useEffect(() => {
        void reloadBase();
    }, [reloadBase]);

    const filteredZahlungen = useMemo(() => {
        const min = filterMin.trim() === "" ? null : Number(filterMin.replace(",", "."));
        const max = filterMax.trim() === "" ? null : Number(filterMax.replace(",", "."));
        const q = filterSearch.trim().toLowerCase();
        return zahlungen.filter((z) => {
            if (filterStatus && z.status !== filterStatus) return false;
            if (min != null && !Number.isNaN(min) && z.betrag < min) return false;
            if (max != null && !Number.isNaN(max) && z.betrag > max) return false;
            if (q) {
                const name = patientName(z.patient_id).toLowerCase();
                const desc = (z.beschreibung ?? "").toLowerCase();
                if (!name.includes(q) && !desc.includes(q) && !z.id.toLowerCase().includes(q)) return false;
            }
            return true;
        });
    }, [zahlungen, filterStatus, filterMin, filterMax, filterSearch, patientName]);

    const step0Valid = bilanzzeitraum.trim().length > 0 && iban.trim().length > 0;

    const goNext = () => {
        if (step === 0 && !step0Valid) {
            toast("Bitte Bilanzzeitraum und IBAN ausfüllen.", "error");
            return;
        }
        setAck(false);
        setStep((s) => Math.min(STEPS.length - 1, s + 1));
    };

    const goBack = () => {
        setAck(false);
        setStep((s) => Math.max(0, s - 1));
    };

    if (dataStatus === "loading") return <PageLoading label="Daten für Bilanz-Assistent werden geladen…" />;
    if (dataStatus === "error" && dataError) return <PageLoadError message={dataError} onRetry={() => void reloadBase()} />;

    const selectedZahlungRows = zahlungen.filter((z) => selZahlung.has(z.id));
    const selectedVertragRows = DEMO_VERTRAEGE.filter((v) => selVertrag.has(v.id));
    const selectedAusgabeRows = ausgabeRows.filter((p) => selAusgabe.has(p.id));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            {canBackVerwaltung ? (
                <div>
                    <VerwaltungBackButton />
                </div>
            ) : null}
            <div className="row" style={{ gap: 10, alignItems: "center" }}>
                <Button type="button" variant="ghost" onClick={() => navigate("/bilanz")}>← Zurück</Button>
                <h1 className="page-title" style={{ margin: 0 }}>Neuer Bilanz</h1>
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }} aria-hidden>
                {STEPS.map((label, i) => (
                    <span
                        key={label}
                        className="pill"
                        style={{
                            opacity: i === step ? 1 : i < step ? 0.85 : 0.45,
                            background: i === step ? "var(--accent-soft)" : undefined,
                            borderColor: i <= step ? "var(--accent)" : undefined,
                        }}
                    >
                        {i + 1}. {label}
                    </span>
                ))}
            </div>
            <Card>
                <div style={{ padding: 16 }}>
                    <CardHeader title={STEPS[step] ?? ""} />
                    <div style={{ marginTop: 12 }}>
                        {step === 0 ? (
                            <>
                                <FormSection title="Allgemeine Angaben">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="Bilanzzeitraum *" placeholder="z. B. 01.01.2026 – 31.03.2026" value={bilanzzeitraum} onChange={(e) => setBilanzzeitraum(e.target.value)} />
                                        <Input label="Organisationseinheit" value={org} onChange={(e) => setOrg(e.target.value)} />
                                        <Select label="Typ" value={bilanzTyp} onChange={(e) => setBilanzTyp(e.target.value)} options={[{ value: "QUARTAL", label: "Quartal" }, { value: "JAHR", label: "Jahr" }]} />
                                    </div>
                                </FormSection>
                                <FormSection title="Persönliche Angaben">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="Vorname" value={vorname} onChange={(e) => setVorname(e.target.value)} />
                                        <Input label="Nachname" value={nachname} onChange={(e) => setNachname(e.target.value)} />
                                    </div>
                                </FormSection>
                                <FormSection title="Bank- und Steuerdaten">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label="IBAN *" value={iban} onChange={(e) => setIban(e.target.value)} />
                                        <Input label="BIC" value={bic} onChange={(e) => setBic(e.target.value)} />
                                        <Input label="Steuernummer" value={steuernummer} onChange={(e) => setSteuernummer(e.target.value)} />
                                        <Input label="Finanzamt" value={finanzamt} onChange={(e) => setFinanzamt(e.target.value)} />
                                    </div>
                                </FormSection>
                            </>
                        ) : null}

                        {step === 1 ? (
                            <FormSection title="Einnahmen — bitte relevante Zahlungen auswählen">
                                <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 0 }}>
                                    Daten aus dem System (Zahlungen). Filter wirken auf die Tabelle.
                                    {!canReadPatients ? " Ohne Patienten-Leserecht werden nur IDs/Kommentare angezeigt." : null}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 12 }}>
                                    <Select
                                        label="Status"
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as "" | ZahlungsStatus)}
                                        options={[
                                            { value: "", label: "Alle" },
                                            { value: "BEZAHLT", label: "Bezahlt" },
                                            { value: "AUSSTEHEND", label: "Ausstehend" },
                                            { value: "TEILBEZAHLT", label: "Teilbezahlt" },
                                            { value: "STORNIERT", label: "Storniert" },
                                        ]}
                                    />
                                    <Input label="Betrag min" value={filterMin} onChange={(e) => setFilterMin(e.target.value)} />
                                    <Input label="Betrag max" value={filterMax} onChange={(e) => setFilterMax(e.target.value)} />
                                    <Input label="Suche (Name / Text)" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
                                </div>
                                <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelZahlung(new Set(filteredZahlungen.map((z) => z.id)))}>Alles selektieren</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelZahlung(new Set())}>Alles deselektieren</Button>
                                </div>
                                <div style={{ overflowX: "auto", maxHeight: 360, border: "1px solid var(--line)", borderRadius: 8 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead style={{ position: "sticky", top: 0, background: "var(--card)" }}>
                                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                                <th style={{ padding: 8, width: 40 }}> </th>
                                                <th style={{ padding: 8 }}>Patient / Ref.</th>
                                                <th style={{ padding: 8 }}>Betrag</th>
                                                <th style={{ padding: 8 }}>Status</th>
                                                <th style={{ padding: 8 }}>Datum</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredZahlungen.map((z) => (
                                                <tr key={z.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                                    <td style={{ padding: 8 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selZahlung.has(z.id)}
                                                            onChange={() => setSelZahlung((s) => toggleSet(s, z.id))}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8 }}>
                                                        <div style={{ fontWeight: 600 }}>{patientName(z.patient_id)}</div>
                                                        <div style={{ fontSize: 12, color: "var(--fg-3)" }}>{z.beschreibung || z.id}</div>
                                                    </td>
                                                    <td style={{ padding: 8 }}>{formatCurrency(z.betrag)}</td>
                                                    <td style={{ padding: 8 }}>{z.status}</td>
                                                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>{formatDateTime(z.created_at)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {filteredZahlungen.length === 0 ? <p style={{ padding: 12, color: "var(--fg-3)" }}>Keine Zahlungen für die Filter.</p> : null}
                                </div>
                            </FormSection>
                        ) : null}

                        {step === 2 ? (
                            <FormSection title="Verträge — Demo-Daten (Auswahl für spätere Anbindung)">
                                <p style={{ color: "var(--fg-3)", fontSize: 13 }}>Beispielverträge wie im Wireframe; noch ohne Datenbankanbindung.</p>
                                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelVertrag(new Set(DEMO_VERTRAEGE.map((v) => v.id)))}>Alles auswählen</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelVertrag(new Set())}>Alles deselektieren</Button>
                                </div>
                                <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                                <th style={{ padding: 8, width: 40 }}> </th>
                                                <th style={{ padding: 8 }}>Vertrag</th>
                                                <th style={{ padding: 8 }}>Typ</th>
                                                <th style={{ padding: 8 }}>Kosten</th>
                                                <th style={{ padding: 8 }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {DEMO_VERTRAEGE.map((v) => (
                                                <tr key={v.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                                    <td style={{ padding: 8 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selVertrag.has(v.id)}
                                                            onChange={() => setSelVertrag((s) => toggleSet(s, v.id))}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8 }}>{v.name}</td>
                                                    <td style={{ padding: 8 }}>{v.typ}</td>
                                                    <td style={{ padding: 8 }}>{formatCurrency(v.kosten)}</td>
                                                    <td style={{ padding: 8 }}>
                                                        <span className="pill" style={{ fontSize: 11, borderColor: v.status === "AKTIV" ? "var(--accent)" : "var(--red)" }}>
                                                            {v.status === "AKTIV" ? "Aktiv" : "Gekündigt"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </FormSection>
                        ) : null}

                        {step === 3 ? (
                            <FormSection title="Ausgaben — Produktkosten (Lager)">
                                <p style={{ color: "var(--fg-3)", fontSize: 13 }}>Produkte aus dem Lager oder Beispieldaten.</p>
                                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelAusgabe(new Set(ausgabeRows.map((p) => p.id)))}>Alles auswählen</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelAusgabe(new Set())}>Alles deselektieren</Button>
                                </div>
                                <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                                <th style={{ padding: 8, width: 40 }}> </th>
                                                <th style={{ padding: 8 }}>Produkt</th>
                                                <th style={{ padding: 8 }}>Kategorie</th>
                                                <th style={{ padding: 8 }}>Preis</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ausgabeRows.map((p) => (
                                                <tr key={p.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                                    <td style={{ padding: 8 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selAusgabe.has(p.id)}
                                                            onChange={() => setSelAusgabe((s) => toggleSet(s, p.id))}
                                                        />
                                                    </td>
                                                    <td style={{ padding: 8 }}>{p.name}</td>
                                                    <td style={{ padding: 8 }}>{p.kategorie}</td>
                                                    <td style={{ padding: 8 }}>{formatCurrency(p.preis)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </FormSection>
                        ) : null}

                        {step === 4 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                                    Zusammenfassung (Vorschau). In dieser Version wird keine Bilanz in der Datenbank gespeichert — die Auswahl dient der Orientierung gemäß Wireframe.
                                </p>
                                <FormSection title="Stammdaten">
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "var(--fg-2)" }}>
                                        <li>Zeitraum: {bilanzzeitraum || "—"}</li>
                                        <li>Organisation: {org}</li>
                                        <li>Typ: {bilanzTyp}</li>
                                        <li>Name: {vorname} {nachname}</li>
                                        <li>IBAN: {iban || "—"} · BIC: {bic || "—"}</li>
                                        <li>Steuer: {steuernummer || "—"} · Finanzamt: {finanzamt || "—"}</li>
                                    </ul>
                                </FormSection>
                                <FormSection title="Auswahl">
                                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "var(--fg-2)" }}>
                                        <li>Einnahmen (Zahlungen): {selectedZahlungRows.length} ausgewählt</li>
                                        <li>Verträge (Demo): {selectedVertragRows.length}</li>
                                        <li>Ausgaben (Produkte): {selectedAusgabeRows.length}</li>
                                    </ul>
                                </FormSection>
                                {selectedZahlungRows.length > 0 ? (
                                    <FormSection title="Ausgewählte Zahlungen (Auszug)">
                                        <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
                                            {selectedZahlungRows.slice(0, 12).map((z) => (
                                                <div key={z.id} className="row" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px dashed var(--line)" }}>
                                                    <span>{patientName(z.patient_id)}</span>
                                                    <span>{formatCurrency(z.betrag)} · {z.status}</span>
                                                </div>
                                            ))}
                                            {selectedZahlungRows.length > 12 ? <p style={{ fontSize: 12, color: "var(--fg-3)" }}>… und {selectedZahlungRows.length - 12} weitere</p> : null}
                                        </div>
                                    </FormSection>
                                ) : null}
                            </div>
                        ) : null}

                        <label className="row" style={{ gap: 10, marginTop: 18, alignItems: "flex-start", cursor: "pointer" }}>
                            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                            <span style={{ fontSize: 13 }}>Schritt gelesen / erledigt</span>
                        </label>
                    </div>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                        <Button type="button" variant="danger" onClick={() => navigate("/bilanz")}>Abbrechen</Button>
                        {step > 0 ? <Button type="button" variant="ghost" onClick={goBack}>Zurück</Button> : null}
                        {step < STEPS.length - 1 ? (
                            <Button type="button" disabled={!ack} onClick={goNext}>Fortfahren</Button>
                        ) : (
                            <Button
                                type="button"
                                disabled={!ack || saving}
                                loading={saving}
                                onClick={async () => {
                                    setSaving(true);
                                    try {
                                        const einnahmenCents = Math.round(
                                            selectedZahlungRows.reduce((s, z) => s + z.betrag, 0) * 100,
                                        );
                                        const ausgabenCents = Math.round(
                                            (selectedAusgabeRows.reduce((s, p) => s + p.preis, 0)
                                                + selectedVertragRows.reduce((s, v) => s + v.kosten, 0)) * 100,
                                        );
                                        const label = `${bilanzTyp} ${bilanzzeitraum}`.trim();
                                        await createBilanzSnapshot({
                                            zeitraum: bilanzzeitraum,
                                            typ: bilanzTyp,
                                            label: label || `Bilanz ${new Date().toISOString().slice(0, 10)}`,
                                            einnahmen_cents: einnahmenCents,
                                            ausgaben_cents: ausgabenCents,
                                            payload: {
                                                stammdaten: { org, vorname, nachname, iban, bic, steuernummer, finanzamt },
                                                einnahmen: selectedZahlungRows.map((z) => ({
                                                    id: z.id, betrag: z.betrag, status: z.status,
                                                    patient_id: z.patient_id, beschreibung: z.beschreibung,
                                                })),
                                                vertraege: selectedVertragRows,
                                                ausgaben: selectedAusgabeRows.map((p) => ({
                                                    id: p.id, name: p.name, kategorie: p.kategorie, preis: p.preis,
                                                })),
                                            },
                                        });
                                        toast("Bilanz-Snapshot gespeichert.", "success");
                                        navigate("/bilanz");
                                    } catch (e) {
                                        toast(`Speichern fehlgeschlagen: ${errorMessage(e)}`, "error");
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                Abschließen
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
