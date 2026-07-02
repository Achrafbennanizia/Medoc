import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listZahlungen } from "@/systems/practice-host/controllers/zahlung.controller";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { listProdukte } from "@/systems/practice-host/controllers/produkt.controller";
import { createBilanzSnapshot } from "@/systems/practice-host/controllers/bilanz-snapshot.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { Patient, Produkt, Zahlung, ZahlungsStatus } from "../../models/types";
import { errorMessage, formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { FormSection } from "../components/ui/form-section";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { useT, useTParams } from "@/lib/i18n";

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
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canReadPatients = role ? allowed("patient.read", role) : false;
    const canBackVerwaltung = role != null && allowed("verwaltung.read", role);

    const steps = useMemo(
        () => [
            t("page.bilanz_neu.step.general"),
            t("page.bilanz_neu.step.income"),
            t("page.bilanz_neu.step.contracts"),
            t("page.bilanz_neu.step.expenses"),
            t("page.bilanz_neu.step.confirm"),
        ],
        [t],
    );

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
            toast(t("page.bilanz_neu.toast.validation"), "error");
            return;
        }
        setAck(false);
        setStep((s) => Math.min(steps.length - 1, s + 1));
    };

    const goBack = () => {
        setAck(false);
        setStep((s) => Math.max(0, s - 1));
    };

    if (dataStatus === "loading") return <PageLoading label={t("page.bilanz_neu.loading")} />;
    if (dataStatus === "error" && dataError) return <PageLoadError message={dataError} onRetry={() => void reloadBase()} />;

    const selectedZahlungRows = zahlungen.filter((z) => selZahlung.has(z.id));
    const selectedVertragRows = DEMO_VERTRAEGE.filter((v) => selVertrag.has(v.id));
    const selectedAusgabeRows = ausgabeRows.filter((p) => selAusgabe.has(p.id));

    const bilanzTypLabel = bilanzTyp === "JAHR" ? t("common.year") : t("common.quarter");

    return (
        <div className="praxis-workspace-page animate-fade-in">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.bilanz_neu.title")}
                back={
                    canBackVerwaltung
                        ? "verwaltung"
                        : { to: "/bilanz", label: t("page.bilanz_neu.back_label") }
                }
            />
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }} aria-hidden>
                {steps.map((label, i) => (
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
                    <CardHeader title={steps[step] ?? ""} />
                    <div style={{ marginTop: 12 }}>
                        {step === 0 ? (
                            <>
                                <FormSection title={t("page.bilanz_neu.section.general")}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label={t("page.bilanz_neu.field.period")} placeholder={t("page.bilanz_neu.field.period_ph")} value={bilanzzeitraum} onChange={(e) => setBilanzzeitraum(e.target.value)} />
                                        <Input label={t("common.organisation_unit")} value={org} onChange={(e) => setOrg(e.target.value)} />
                                        <Select label={t("common.type")} value={bilanzTyp} onChange={(e) => setBilanzTyp(e.target.value)} options={[{ value: "QUARTAL", label: t("common.quarter") }, { value: "JAHR", label: t("common.year") }]} />
                                    </div>
                                </FormSection>
                                <FormSection title={t("page.bilanz_neu.section.personal")}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label={t("common.first_name")} value={vorname} onChange={(e) => setVorname(e.target.value)} />
                                        <Input label={t("common.last_name")} value={nachname} onChange={(e) => setNachname(e.target.value)} />
                                    </div>
                                </FormSection>
                                <FormSection title={t("page.bilanz_neu.section.bank_tax")}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Input label={t("page.bilanz_neu.field.iban")} value={iban} onChange={(e) => setIban(e.target.value)} />
                                        <Input label="BIC" value={bic} onChange={(e) => setBic(e.target.value)} />
                                        <Input label={t("common.tax_number")} value={steuernummer} onChange={(e) => setSteuernummer(e.target.value)} />
                                        <Input label={t("common.tax_office")} value={finanzamt} onChange={(e) => setFinanzamt(e.target.value)} />
                                    </div>
                                </FormSection>
                            </>
                        ) : null}

                        {step === 1 ? (
                            <FormSection title={t("page.bilanz_neu.income.title")}>
                                <p style={{ color: "var(--fg-3)", fontSize: 13, marginTop: 0 }}>
                                    {t("page.bilanz_neu.income.hint")}
                                    {!canReadPatients ? t("page.bilanz_neu.income.hint_no_patient_read") : null}
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 12 }}>
                                    <Select
                                        label={t("common.status")}
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value as "" | ZahlungsStatus)}
                                        options={[
                                            { value: "", label: t("common.all") },
                                            { value: "BEZAHLT", label: t("enum.zahlung_status.bezahlt") },
                                            { value: "AUSSTEHEND", label: t("enum.zahlung_status.ausstehend") },
                                            { value: "TEILBEZAHLT", label: t("enum.zahlung_status.teilbezahlt") },
                                            { value: "STORNIERT", label: t("enum.zahlung_status.storniert") },
                                        ]}
                                    />
                                    <Input label={t("common.amount_min")} value={filterMin} onChange={(e) => setFilterMin(e.target.value)} />
                                    <Input label={t("common.amount_max")} value={filterMax} onChange={(e) => setFilterMax(e.target.value)} />
                                    <Input label={t("common.search_name_text")} value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
                                </div>
                                <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelZahlung(new Set(filteredZahlungen.map((z) => z.id)))}>{t("common.select_all")}</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelZahlung(new Set())}>{t("common.deselect_all")}</Button>
                                </div>
                                <div style={{ overflowX: "auto", maxHeight: 360, border: "1px solid var(--line)", borderRadius: 8 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead style={{ position: "sticky", top: 0, background: "var(--card)" }}>
                                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                                <th style={{ padding: 8, width: 40 }}> </th>
                                                <th style={{ padding: 8 }}>{t("common.patient_ref")}</th>
                                                <th style={{ padding: 8 }}>{t("common.amount")}</th>
                                                <th style={{ padding: 8 }}>{t("common.status")}</th>
                                                <th style={{ padding: 8 }}>{t("common.date")}</th>
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
                                    {filteredZahlungen.length === 0 ? <p style={{ padding: 12, color: "var(--fg-3)" }}>{t("page.bilanz_neu.income.no_results")}</p> : null}
                                </div>
                            </FormSection>
                        ) : null}

                        {step === 2 ? (
                            <FormSection title={t("page.bilanz_neu.contracts.title")}>
                                <p style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("page.bilanz_neu.contracts.hint")}</p>
                                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelVertrag(new Set(DEMO_VERTRAEGE.map((v) => v.id)))}>{t("common.select_all")}</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelVertrag(new Set())}>{t("common.deselect_all")}</Button>
                                </div>
                                <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                                <th style={{ padding: 8, width: 40 }}> </th>
                                                <th style={{ padding: 8 }}>{t("common.contract")}</th>
                                                <th style={{ padding: 8 }}>{t("common.type")}</th>
                                                <th style={{ padding: 8 }}>{t("page.bilanz_neu.col.cost")}</th>
                                                <th style={{ padding: 8 }}>{t("common.status")}</th>
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
                                                            {v.status === "AKTIV" ? t("common.active") : t("common.terminated")}
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
                            <FormSection title={t("page.bilanz_neu.expenses.title")}>
                                <p style={{ color: "var(--fg-3)", fontSize: 13 }}>{t("page.bilanz_neu.expenses.hint")}</p>
                                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                                    <Button type="button" variant="secondary" size="sm" onClick={() => setSelAusgabe(new Set(ausgabeRows.map((p) => p.id)))}>{t("common.select_all")}</Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelAusgabe(new Set())}>{t("common.deselect_all")}</Button>
                                </div>
                                <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                        <thead>
                                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                                <th style={{ padding: 8, width: 40 }}> </th>
                                                <th style={{ padding: 8 }}>{t("common.product")}</th>
                                                <th style={{ padding: 8 }}>{t("common.category")}</th>
                                                <th style={{ padding: 8 }}>{t("common.price")}</th>
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
                                    {t("page.bilanz_neu.confirm.summary")}
                                </p>
                                <FormSection title={t("page.bilanz_neu.section.master_data")}>
                                    <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 14, color: "var(--fg-2)" }}>
                                        <li>{tp("page.bilanz_neu.summary.period", { period: bilanzzeitraum || "—" })}</li>
                                        <li>{tp("page.bilanz_neu.summary.org", { org })}</li>
                                        <li>{tp("page.bilanz_neu.summary.type", { type: bilanzTypLabel })}</li>
                                        <li>{tp("page.bilanz_neu.summary.name", { first: vorname, last: nachname })}</li>
                                        <li>{tp("page.bilanz_neu.summary.iban", { iban: iban || "—", bic: bic || "—" })}</li>
                                        <li>{tp("page.bilanz_neu.summary.tax", { tax: steuernummer || "—", office: finanzamt || "—" })}</li>
                                    </ul>
                                </FormSection>
                                <FormSection title={t("page.bilanz_neu.section.selection")}>
                                    <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 14, color: "var(--fg-2)" }}>
                                        <li>{tp("page.bilanz_neu.summary.income_count", { count: selectedZahlungRows.length })}</li>
                                        <li>{tp("page.bilanz_neu.summary.contracts_count", { count: selectedVertragRows.length })}</li>
                                        <li>{tp("page.bilanz_neu.summary.expenses_count", { count: selectedAusgabeRows.length })}</li>
                                    </ul>
                                </FormSection>
                                {selectedZahlungRows.length > 0 ? (
                                    <FormSection title={t("page.bilanz_neu.section.selected_payments")}>
                                        <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 8 }}>
                                            {selectedZahlungRows.slice(0, 12).map((z) => (
                                                <div key={z.id} className="row" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: "1px dashed var(--line)" }}>
                                                    <span>{patientName(z.patient_id)}</span>
                                                    <span>{formatCurrency(z.betrag)} · {z.status}</span>
                                                </div>
                                            ))}
                                            {selectedZahlungRows.length > 12 ? <p style={{ fontSize: 12, color: "var(--fg-3)" }}>{tp("common.and_more", { count: selectedZahlungRows.length - 12 })}</p> : null}
                                        </div>
                                    </FormSection>
                                ) : null}
                            </div>
                        ) : null}

                        <label className="row" style={{ gap: 10, marginTop: 18, alignItems: "flex-start", cursor: "pointer" }}>
                            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                            <span style={{ fontSize: 13 }}>{t("common.step_ack")}</span>
                        </label>
                    </div>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                        <Button type="button" variant="danger" onClick={() => navigate("/bilanz")}>{t("common.cancel")}</Button>
                        {step > 0 ? <Button type="button" variant="ghost" onClick={goBack}>{t("common.back")}</Button> : null}
                        {step < steps.length - 1 ? (
                            <Button type="button" disabled={!ack} onClick={goNext}>{t("common.continue")}</Button>
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
                                        toast(t("page.bilanz_neu.toast.saved"), "success");
                                        navigate("/bilanz");
                                    } catch (e) {
                                        toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                            >
                                {t("common.finish")}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}
