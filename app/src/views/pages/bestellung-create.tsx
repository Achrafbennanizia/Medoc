import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createBestellung, listBestellungen, type Bestellung } from "../../controllers/bestellung.controller";
import { listProdukte } from "../../controllers/produkt.controller";
import {
    listLieferantStamm,
    listPharmaberaterStamm,
    listLieferantPharmaVorlagen,
} from "../../controllers/praxis.controller";
import { countProdukteWithName, errorMessage, formatCurrency, produktSelectLabel } from "@/lib/utils";
import { roundMoney2 } from "@/lib/zahlung-buchung";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import type { LieferantPharmaVorlage, LieferantStamm, PharmaberaterStamm, Produkt } from "@/models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Textarea, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { ChevronLeftIcon } from "@/lib/icons";

interface CreateForm {
    lieferant: string;
    /** Auswahl aus `Produkt.id` (Artikel-Text in der Bestellung = `Produkt.name`) */
    artikelProduktId: string;
    menge: string;
    einheit: string;
    erwartet_am: string;
    bemerkung: string;
    pharmaberater: string;
}

function emptyForm(): CreateForm {
    return {
        lieferant: "",
        artikelProduktId: "",
        menge: "1",
        einheit: "",
        erwartet_am: "",
        bemerkung: "",
        pharmaberater: "",
    };
}

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Anzeigetext für Schnellwahl-Vorlage (Lieferant · Kontakt · Produkt). */
function formatVorlageDatalistLine(v: LieferantPharmaVorlage): string {
    const base = `${v.lieferant_name} · ${v.pharmaberater_name} · `;
    const prod =
        v.produkt_aktiv === 0
            ? `${v.produkt_name} (Lager: inaktiv)`
            : `${v.produkt_name} · ${v.produkt_kategorie} · ${formatCurrency(v.produkt_preis)}`;
    return base + prod;
}

function buildVorlagenDatalistRows(vorlagen: LieferantPharmaVorlage[]) {
    const seen = new Map<string, number>();
    const rows: { v: LieferantPharmaVorlage; label: string }[] = [];
    for (const v of vorlagen) {
        const line = formatVorlageDatalistLine(v);
        const c = (seen.get(line) ?? 0) + 1;
        seen.set(line, c);
        const label = c > 1 ? `${line} · #${v.id.slice(0, 8)}` : line;
        rows.push({ v, label });
    }
    return rows;
}

function validateForm(f: CreateForm, anzahlProdukte: number): string | null {
    const menge = Number(f.menge);
    if (!f.lieferant.trim()) return "Lieferant erforderlich";
    if (anzahlProdukte < 1) return "Zuerst mindestens ein Produkt im Lager anlegen";
    if (!f.artikelProduktId.trim()) return "Produkt (Artikel) erforderlich";
    if (!Number.isFinite(menge) || menge <= 0) return "Menge muss positiv sein";
    if (f.erwartet_am && f.erwartet_am < todayISO()) return "Erwartet-Datum darf nicht in der Vergangenheit liegen";
    return null;
}

export function BestellungCreatePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const toast = useToastStore((s) => s.add);
    const from = searchParams.get("from");
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canAddProdukt = role != null && allowed("produkt.write", role);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [rowsForHints, setRowsForHints] = useState<Bestellung[]>([]);
    const [produkte, setProdukte] = useState<Produkt[]>([]);
    const [lieferantenStamm, setLieferantenStamm] = useState<LieferantStamm[]>([]);
    const [pharmaberaterStamm, setPharmaberaterStamm] = useState<PharmaberaterStamm[]>([]);
    const [vorlagen, setVorlagen] = useState<LieferantPharmaVorlage[]>([]);
    /** Eingabetext; exakter Treffer mit `datalist` übernimmt Lieferant/Kontakt/Produkt. */
    const [vorlageInputText, setVorlageInputText] = useState("");
    const vorlageDatalistDomId = useId();

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<CreateForm>(emptyForm);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [list, lief, ph, vor, prods] = await Promise.all([
                listBestellungen(),
                listLieferantStamm(),
                listPharmaberaterStamm(),
                listLieferantPharmaVorlagen(),
                listProdukte(),
            ]);
            setRowsForHints(list);
            setProdukte(prods);
            setLieferantenStamm(lief);
            setPharmaberaterStamm(ph);
            setVorlagen(vor);
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const lieferantSuggestions = useMemo(() => {
        const set = new Set<string>();
        for (const x of lieferantenStamm) set.add(x.name);
        for (const r of rowsForHints) if (r.lieferant) set.add(r.lieferant);
        return Array.from(set).sort();
    }, [lieferantenStamm, rowsForHints]);

    const pharmaSuggestions = useMemo(() => {
        const set = new Set<string>();
        for (const x of pharmaberaterStamm) set.add(x.name);
        for (const r of rowsForHints) if (r.pharmaberater) set.add(r.pharmaberater);
        return Array.from(set).sort();
    }, [pharmaberaterStamm, rowsForHints]);

    const produkteSorted = useMemo(
        () => [...produkte].sort((a, b) => a.name.localeCompare(b.name, "de")),
        [produkte],
    );

    const artikelProduktOptions = useMemo(
        () => [
            { value: "", label: "— Produkt aus Lager wählen —" },
            ...produkteSorted.map((p) => ({
                value: p.id,
                label: produktSelectLabel(p, countProdukteWithName(produkte, p.name)),
            })),
        ],
        [produkte, produkteSorted],
    );

    const vorlagenDatalistRows = useMemo(() => buildVorlagenDatalistRows(vorlagen), [vorlagen]);
    const vorlageByDatalistLabel = useMemo(
        () => new Map(vorlagenDatalistRows.map((r) => [r.label, r.v] as const)),
        [vorlagenDatalistRows],
    );

    const voraussichtGesamtbetrag = useMemo(() => {
        const p = produkte.find((x) => x.id === form.artikelProduktId);
        const m = Number(String(form.menge).replace(",", "."));
        if (!p || !Number.isFinite(m) || m <= 0) return null;
        return roundMoney2(p.preis * m);
    }, [produkte, form.artikelProduktId, form.menge]);

    function goNeuesProdukt() {
        const returnTo = `${location.pathname}${location.search}`;
        const params = new URLSearchParams();
        params.set("neu", "1");
        params.set("returnTo", returnTo);
        navigate(`/produkte?${params.toString()}`);
    }

    function goBack() {
        if (from === "finanzen") navigate("/finanzen");
        else navigate("/bestellungen");
    }

    async function handleCreate() {
        const err = validateForm(form, produkte.length);
        if (err) {
            setError(err);
            return;
        }
        const produkt = produkte.find((p) => p.id === form.artikelProduktId);
        if (!produkt) {
            setError("Ungültige Produktauswahl.");
            return;
        }
        const mengeN = Number(String(form.menge).replace(",", "."));
        const gesamtbetrag =
            Number.isFinite(mengeN) && mengeN > 0 ? roundMoney2(produkt.preis * mengeN) : null;
        setBusy(true);
        setError(null);
        try {
            const created = await createBestellung({
                lieferant: form.lieferant.trim(),
                artikel: produkt.name,
                menge: mengeN,
                einheit: form.einheit.trim() || null,
                erwartet_am: form.erwartet_am || null,
                bemerkung: form.bemerkung.trim() || null,
                pharmaberater: form.pharmaberater.trim() || null,
                ...(gesamtbetrag != null ? { gesamtbetrag: gesamtbetrag } : {}),
            });
            toast(`Bestellung ${created.bestellnummer ?? ""} angelegt`, "success");
            navigate(`/bestellungen/${created.id}`);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <PageLoading label="Bestellungen werden geladen…" />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load()} />;

    const validationError = validateForm(form, produkte.length);
    const cannotSave = validationError !== null || busy;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in--sticky-safe">
            <div className="page-head">
                <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <Button type="button" variant="secondary" onClick={goBack}>
                        <ChevronLeftIcon />Zurück
                    </Button>
                    <div>
                        <div className="page-sub">Bestellungen</div>
                        <h2 className="page-title" style={{ margin: 0 }}>
                            Neue Bestellung
                        </h2>
                    </div>
                </div>
            </div>

            <datalist id="best-create-lieferant-list">
                {lieferantSuggestions.map((l) => (
                    <option key={l} value={l} />
                ))}
            </datalist>
            <datalist id="best-create-pharma-list">
                {pharmaSuggestions.map((p) => (
                    <option key={p} value={p} />
                ))}
            </datalist>

            <div style={{ maxWidth: 720, width: "100%" }}>
                <Card>
                <CardHeader title="Bestelldaten" subtitle="Artikel = Produkt aus dem Lager; erwartete Lieferung und Mengen" />
                <div className="card-pad" style={{ paddingTop: 0 }}>
                    {error ? (
                        <p
                            style={{
                                color: "var(--red)",
                                fontSize: 12.5,
                                margin: "0 0 12px",
                                padding: "8px 12px",
                                background: "var(--red-soft)",
                                borderRadius: 8,
                            }}
                        >
                            {error}
                        </p>
                    ) : null}
                    <p style={{ color: "var(--fg-3)", fontSize: 12, marginTop: 0, marginBottom: 16, lineHeight: 1.45 }}>
                        Bestellnummer wird automatisch im Format <code>B-JJJJ-MM-NNNN</code> erzeugt.
                    </p>
                    {vorlagen.length > 0 ? (
                        <div style={{ marginBottom: 16 }}>
                            <Input
                                id="bc-vorlage"
                                label="Vorlage (Lieferant + Kontakt + Produkt)"
                                list={vorlageDatalistDomId}
                                value={vorlageInputText}
                                autoComplete="off"
                                placeholder="Tippen, filtern oder Eintrag aus Liste wählen…"
                                onChange={(e) => {
                                    const t = e.target.value;
                                    setVorlageInputText(t);
                                    const v = vorlageByDatalistLabel.get(t.trim());
                                    if (v) {
                                        const p = produkte.find((x) => x.id === v.produkt_id);
                                        setForm((f) => ({
                                            ...f,
                                            lieferant: v.lieferant_name,
                                            pharmaberater: v.pharmaberater_name,
                                            artikelProduktId: p ? v.produkt_id : "",
                                        }));
                                        if (v.produkt_id && !p) {
                                            toast(
                                                "Produkt dieser Vorlage ist im Lager nicht aktiv — bitte Artikel manuell wählen.",
                                                "error",
                                            );
                                        }
                                    }
                                }}
                            />
                            <datalist id={vorlageDatalistDomId}>
                                {vorlagenDatalistRows.map(({ v, label }) => (
                                    <option key={v.id} value={label} />
                                ))}
                            </datalist>
                        </div>
                    ) : null}
                    <Input
                        id="bc-lief"
                        label="Lieferant"
                        list="best-create-lieferant-list"
                        value={form.lieferant}
                        onChange={(e) => {
                            setVorlageInputText("");
                            setForm({ ...form, lieferant: e.target.value });
                        }}
                    />
                    <Input
                        id="bc-pharma"
                        label="Pharmaberater / Kontakt"
                        list="best-create-pharma-list"
                        value={form.pharmaberater}
                        onChange={(e) => {
                            setVorlageInputText("");
                            setForm({ ...form, pharmaberater: e.target.value });
                        }}
                    />
                    <div className="row" style={{ alignItems: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                            <Select
                                id="bc-art"
                                label="Artikel (Produkt)"
                                value={form.artikelProduktId}
                                onChange={(e) => {
                                    setVorlageInputText("");
                                    setForm({ ...form, artikelProduktId: e.target.value });
                                }}
                                options={artikelProduktOptions}
                            />
                        </div>
                        {canAddProdukt ? (
                            <Button
                                type="button"
                                variant="secondary"
                                title="Neues Produkt anlegen (Lager)"
                                onClick={goNeuesProdukt}
                                style={{ marginBottom: 8 }}
                            >
                                + Produkt
                            </Button>
                        ) : null}
                    </div>
                    {produkte.length === 0 ? (
                        <p style={{ color: "var(--fg-3)", fontSize: 12, margin: "-4px 0 8px" }}>
                            Keine Produkte im Lager — zuerst per „+ Produkt“ oder unter Produkte anlegen.
                        </p>
                    ) : null}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            id="bc-menge"
                            label="Menge"
                            type="number"
                            min={1}
                            value={form.menge}
                            onChange={(e) => setForm({ ...form, menge: e.target.value })}
                        />
                        <Input
                            id="bc-einheit"
                            label="Einheit"
                            placeholder="z. B. Stück, Pkg."
                            value={form.einheit}
                            onChange={(e) => setForm({ ...form, einheit: e.target.value })}
                        />
                    </div>
                    {voraussichtGesamtbetrag != null ? (
                        <div
                            className="rounded-lg px-4 py-3"
                            style={{
                                border: "1px solid var(--line)",
                                background: "color-mix(in oklab, var(--accent) 6%, transparent)",
                            }}
                        >
                            <div className="form-label form-label--wide">Voraussichtlicher Betrag (Lager-Preis × Menge)</div>
                            <div style={{ fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                {formatCurrency(voraussichtGesamtbetrag)}
                            </div>
                            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--fg-3)", lineHeight: 1.45 }}>
                                Entspricht dem Produktpreis im Lager × eingegebene Menge — erscheint in Finanzen unter Ausgaben.
                            </p>
                        </div>
                    ) : null}
                    <Input
                        id="bc-erw"
                        label="Erwartet am"
                        type="date"
                        min={todayISO()}
                        value={form.erwartet_am}
                        onChange={(e) => setForm({ ...form, erwartet_am: e.target.value })}
                    />
                    <Textarea
                        id="bc-bem"
                        label="Bemerkung"
                        rows={3}
                        value={form.bemerkung}
                        onChange={(e) => setForm({ ...form, bemerkung: e.target.value })}
                    />
                    <div
                        className="row"
                        style={{
                            justifyContent: "flex-end",
                            gap: 8,
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: "1px solid var(--line)",
                        }}
                    >
                        <Button type="button" variant="ghost" onClick={goBack} disabled={busy}>
                            Abbrechen
                        </Button>
                        <Button type="button" onClick={() => void handleCreate()} loading={busy} disabled={cannotSave}>
                            Erstellen
                        </Button>
                    </div>
                </div>
                </Card>
            </div>
        </div>
    );
}
