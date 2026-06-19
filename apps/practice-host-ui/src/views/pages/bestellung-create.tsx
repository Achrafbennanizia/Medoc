import { useT, useTParams } from "@/lib/i18n";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createBestellung, listBestellungen, type Bestellung } from "@/systems/practice-host/controllers/bestellung.controller";
import { listProdukte } from "@/systems/practice-host/controllers/produkt.controller";
import {
    listLieferantStamm,
    listPharmaberaterStamm,
    listLieferantPharmaVorlagen,
} from "@/systems/practice-host/controllers/praxis.controller";
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
import { WorkspacePageHeader } from "../components/verwaltung-page-header";

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
function formatVorlageDatalistLine(
    v: LieferantPharmaVorlage,
    tp: (key: string, params: Record<string, string | number>) => string,
): string {
    const prod =
        v.produkt_aktiv === 0
            ? tp("page.bestellung.create.vorlage_line_inactive", { name: v.produkt_name })
            : `${v.produkt_name} · ${v.produkt_kategorie} · ${formatCurrency(v.produkt_preis)}`;
    return tp("page.bestellung.create.vorlage_line", {
        supplier: v.lieferant_name,
        contact: v.pharmaberater_name,
        product: prod,
    });
}

function buildVorlagenDatalistRows(
    vorlagen: LieferantPharmaVorlage[],
    tp: (key: string, params: Record<string, string | number>) => string,
) {
    const seen = new Map<string, number>();
    const rows: { v: LieferantPharmaVorlage; label: string }[] = [];
    for (const v of vorlagen) {
        const line = formatVorlageDatalistLine(v, tp);
        const c = (seen.get(line) ?? 0) + 1;
        seen.set(line, c);
        const label = c > 1 ? `${line} · #${v.id.slice(0, 8)}` : line;
        rows.push({ v, label });
    }
    return rows;
}

function validateForm(f: CreateForm, anzahlProdukte: number, t: (key: string) => string): string | null {
    const menge = Number(f.menge);
    if (!f.lieferant.trim()) return t("page.bestellung.create.validation.supplier_required");
    if (anzahlProdukte < 1) return t("page.bestellung.create.validation.products_required");
    if (!f.artikelProduktId.trim()) return t("page.bestellung.create.validation.article_required");
    if (!Number.isFinite(menge) || menge <= 0) return t("page.bestellung.create.validation.quantity_positive");
    if (f.erwartet_am && f.erwartet_am < todayISO()) return t("page.bestellung.create.validation.date_past");
    return null;
}

export function BestellungCreatePage() {
    const t = useT();
    const tp = useTParams();
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
            { value: "", label: t("page.bestellung.create.product_select_ph") },
            ...produkteSorted.map((p) => ({
                value: p.id,
                label: produktSelectLabel(p, countProdukteWithName(produkte, p.name)),
            })),
        ],
        [produkte, produkteSorted, t],
    );

    const vorlagenDatalistRows = useMemo(() => buildVorlagenDatalistRows(vorlagen, tp), [vorlagen, tp]);
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
        const err = validateForm(form, produkte.length, t);
        if (err) {
            setError(err);
            return;
        }
        const produkt = produkte.find((p) => p.id === form.artikelProduktId);
        if (!produkt) {
            setError(t("page.bestellung.create.invalid_product"));
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
            toast(tp("page.bestellung.create.created_toast", { nummer: created.bestellnummer ?? "" }), "success");
            navigate(`/bestellungen?bestellung=${encodeURIComponent(created.id)}`);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    if (loading) return <PageLoading label={t("page.bestellungen.loading")} />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load()} />;

    const validationError = validateForm(form, produkte.length, t);
    const cannotSave = validationError !== null || busy;

    return (
        <div className="bestellung-create-page praxis-workspace-page praxis-workspace-page--form animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                title={t("page.bestellung.create.title")}
                back={{ onClick: goBack, label: t("page.bestellungen.title") }}
            />

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

            <Card className="bestellung-create-page__card card-elevated">
                <CardHeader title={t("page.bestellung.create.card_title")} subtitle={t("page.bestellung.create.card_sub")} />
                <div className="card-pad bestellung-create-form">
                    {error ? (
                        <p className="bestellung-create-form__error">{error}</p>
                    ) : null}
                    <p className="bestellung-create-form__hint">
                        {t("page.bestellung.create.order_number_hint")}
                    </p>
                    {vorlagen.length > 0 ? (
                        <div className="bestellung-create-form__field">
                            <Input
                                id="bc-vorlage"
                                label={t("page.bestellung.create.template_label")}
                                list={vorlageDatalistDomId}
                                value={vorlageInputText}
                                autoComplete="off"
                                placeholder={t("page.bestellung.create.search_ph")}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setVorlageInputText(val);
                                    const v = vorlageByDatalistLabel.get(val.trim());
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
                                                t("page.bestellung.create.template_inactive_toast"),
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
                    <div className="bestellung-create-form__grid bestellung-create-form__grid--2">
                        <Input
                            id="bc-lief"
                            label={t("common.supplier")}
                            list="best-create-lieferant-list"
                            value={form.lieferant}
                            onChange={(e) => {
                                setVorlageInputText("");
                                setForm({ ...form, lieferant: e.target.value });
                            }}
                        />
                        <Input
                            id="bc-pharma"
                            label={t("page.bestellung.create.pharma_contact")}
                            list="best-create-pharma-list"
                            value={form.pharmaberater}
                            onChange={(e) => {
                                setVorlageInputText("");
                                setForm({ ...form, pharmaberater: e.target.value });
                            }}
                        />
                    </div>
                    <div className="bestellung-create-form__field bestellung-create-form__artikel-row">
                        <Select
                            id="bc-art"
                            label={t("page.bestellung.create.article_label")}
                            value={form.artikelProduktId}
                            onChange={(e) => {
                                setVorlageInputText("");
                                setForm({ ...form, artikelProduktId: e.target.value });
                            }}
                            options={artikelProduktOptions}
                        />
                        {canAddProdukt ? (
                            <Button
                                type="button"
                                variant="secondary"
                                title={t("page.bestellung.create.new_product_title")}
                                onClick={goNeuesProdukt}
                            >
                                {t("page.bestellung.create.new_product_btn")}
                            </Button>
                        ) : null}
                    </div>
                    {produkte.length === 0 ? (
                        <p className="bestellung-create-form__note">
                            {t("page.bestellung.create.no_products_note")}
                        </p>
                    ) : null}
                    <div className="bestellung-create-form__grid bestellung-create-form__grid--2">
                        <Input
                            id="bc-menge"
                            label={t("common.quantity")}
                            type="number"
                            min={1}
                            value={form.menge}
                            onChange={(e) => setForm({ ...form, menge: e.target.value })}
                        />
                        <Input
                            id="bc-einheit"
                            label={t("common.unit")}
                            placeholder={t("page.bestellung.create.unit_ph")}
                            value={form.einheit}
                            onChange={(e) => setForm({ ...form, einheit: e.target.value })}
                        />
                    </div>
                    {voraussichtGesamtbetrag != null ? (
                        <div className="bestellung-create-form__betrag">
                            <div className="form-label form-label--wide">{t("page.bestellung.create.amount_label")}</div>
                            <div className="bestellung-create-form__betrag-value">
                                {formatCurrency(voraussichtGesamtbetrag)}
                            </div>
                            <p className="bestellung-create-form__note">
                                {t("page.bestellung.create.amount_note")}
                            </p>
                        </div>
                    ) : null}
                    <Input
                        id="bc-erw"
                        label={t("common.expected_on")}
                        type="date"
                        min={todayISO()}
                        value={form.erwartet_am}
                        onChange={(e) => setForm({ ...form, erwartet_am: e.target.value })}
                    />
                    <Textarea
                        id="bc-bem"
                        label={t("common.note")}
                        rows={3}
                        value={form.bemerkung}
                        onChange={(e) => setForm({ ...form, bemerkung: e.target.value })}
                    />
                    <div className="bestellung-create-form__actions">
                        <Button type="button" variant="ghost" onClick={goBack} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" onClick={() => void handleCreate()} loading={busy} disabled={cannotSave}>
                            {t("common.create")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
