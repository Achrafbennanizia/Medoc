import { useT, useTParams , useCollatorLocale} from "@/lib/i18n";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { createBestellung } from "@/systems/practice-host/controllers/bestellung.controller";
import { listProdukte } from "@/systems/practice-host/controllers/produkt.controller";
import {
    listLieferantStamm,
    listPharmaberaterStamm,
    listLieferantPharmaVorlagen,
} from "@/systems/practice-host/controllers/praxis.controller";
import {
    clearBestellungCreateDraft,
    emptyBestellungCreateDraft,
    readBestellungCreateDraft,
    saveBestellungCreateDraft,
    type BestellungCreateDraft,
} from "@/lib/bestellung-produkt-bridge";
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

/** Display text for quick-select template (supplier · contact · product). */
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

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function validateForm(f: BestellungCreateDraft, anzahlProdukte: number, t: (key: string) => string): string | null {
    const menge = Number(f.menge);
    if (!f.lieferantId.trim()) return t("page.bestellung.create.validation.supplier_required");
    if (anzahlProdukte < 1) return t("page.bestellung.create.validation.products_required");
    if (!f.artikelProduktId.trim()) return t("page.bestellung.create.validation.article_required");
    if (!Number.isFinite(menge) || menge <= 0) return t("page.bestellung.create.validation.quantity_positive");
    if (f.erwartet_am && f.erwartet_am < todayISO()) return t("page.bestellung.create.validation.date_past");
    return null;
}

function stammName(list: { id: string; name: string }[], id: string): string {
    return list.find((x) => x.id === id)?.name.trim() ?? "";
}

export function BestellungCreatePage() {
    const t = useT();
    const sortLocale = useCollatorLocale();
    const tp = useTParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const toast = useToastStore((s) => s.add);
    const from = searchParams.get("from");
    const produktIdFromReturn = searchParams.get("produktId");
    const role = parseRole(useAuthStore((s) => s.session?.rolle));
    const canAddProdukt = role != null && allowed("produkt.write", role);

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [produkte, setProdukte] = useState<Produkt[]>([]);
    const [lieferantenStamm, setLieferantenStamm] = useState<LieferantStamm[]>([]);
    const [pharmaberaterStamm, setPharmaberaterStamm] = useState<PharmaberaterStamm[]>([]);
    const [vorlagen, setVorlagen] = useState<LieferantPharmaVorlage[]>([]);
    const vorlageDatalistDomId = useId();

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<BestellungCreateDraft>(emptyBestellungCreateDraft);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [lief, ph, vor, prods] = await Promise.all([
                listLieferantStamm(),
                listPharmaberaterStamm(),
                listLieferantPharmaVorlagen(),
                listProdukte(),
            ]);
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

    /** Restore draft after returning from New product. */
    useEffect(() => {
        if (!produktIdFromReturn) return;
        const draft = readBestellungCreateDraft();
        const next: BestellungCreateDraft = {
            ...(draft ?? emptyBestellungCreateDraft()),
            artikelProduktId: produktIdFromReturn,
        };
        setForm(next);
        clearBestellungCreateDraft();
        setSearchParams(
            (prev) => {
                const n = new URLSearchParams(prev);
                n.delete("produktId");
                return n;
            },
            { replace: true },
        );
    }, [produktIdFromReturn, setSearchParams]);

    const stammPlaceholder = t("page.bestellstamm.select_placeholder");
    const lieferantOptions = useMemo(
        () => [
            { value: "", label: stammPlaceholder },
            ...lieferantenStamm.map((x) => ({ value: x.id, label: x.name })),
        ],
        [lieferantenStamm, stammPlaceholder],
    );
    const pharmaOptions = useMemo(
        () => [
            { value: "", label: stammPlaceholder },
            ...pharmaberaterStamm.map((x) => ({ value: x.id, label: x.name })),
        ],
        [pharmaberaterStamm, stammPlaceholder],
    );

    const produkteSorted = useMemo(
        () => [...produkte].sort((a, b) => a.name.localeCompare(b.name, sortLocale)),
        [produkte, sortLocale],
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
        saveBestellungCreateDraft(form);
        const returnTo = `${location.pathname}${location.search}`;
        const params = new URLSearchParams();
        params.set("neu", "1");
        params.set("returnTo", returnTo);
        navigate(`/produkte?${params.toString()}`);
    }

    function goBack() {
        clearBestellungCreateDraft();
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
        const lieferantName = stammName(lieferantenStamm, form.lieferantId);
        if (!lieferantName) {
            setError(t("page.bestellung.create.validation.supplier_required"));
            return;
        }
        const mengeN = Number(String(form.menge).replace(",", "."));
        const gesamtbetrag =
            Number.isFinite(mengeN) && mengeN > 0 ? roundMoney2(produkt.preis * mengeN) : null;
        const pharmaberaterName = stammName(pharmaberaterStamm, form.pharmaberaterId);
        setBusy(true);
        setError(null);
        try {
            const created = await createBestellung({
                lieferant: lieferantName,
                artikel: produkt.name,
                menge: mengeN,
                einheit: form.einheit.trim() || null,
                erwartet_am: form.erwartet_am || null,
                bemerkung: form.bemerkung.trim() || null,
                pharmaberater: pharmaberaterName || null,
                ...(gesamtbetrag != null ? { gesamtbetrag: gesamtbetrag } : {}),
            });
            clearBestellungCreateDraft();
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
    const stammEmpty = lieferantenStamm.length === 0 || pharmaberaterStamm.length === 0;

    return (
        <div className="bestellung-create-page praxis-workspace-page praxis-workspace-page--form animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                title={t("page.bestellung.create.title")}
                back={{ onClick: goBack, label: t("page.bestellungen.title") }}
            />

            <Card className="bestellung-create-page__card card-elevated card--overflow-visible">
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
                                value={form.vorlageInputText}
                                autoComplete="off"
                                placeholder={t("page.bestellung.create.search_ph")}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const v = vorlageByDatalistLabel.get(val.trim());
                                    if (v) {
                                        const p = produkte.find((x) => x.id === v.produkt_id);
                                        setForm((f) => ({
                                            ...f,
                                            vorlageInputText: val,
                                            lieferantId: v.lieferant_id,
                                            pharmaberaterId: v.pharmaberater_id,
                                            artikelProduktId: p ? v.produkt_id : "",
                                        }));
                                        if (v.produkt_id && !p) {
                                            toast(
                                                t("page.bestellung.create.template_inactive_toast"),
                                                "error",
                                            );
                                        }
                                    } else {
                                        setForm((f) => ({ ...f, vorlageInputText: val }));
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
                        <Select
                            id="bc-lief"
                            label={t("common.supplier")}
                            value={form.lieferantId}
                            onChange={(e) => {
                                setForm((f) => ({
                                    ...f,
                                    vorlageInputText: "",
                                    lieferantId: e.target.value,
                                }));
                            }}
                            options={lieferantOptions}
                            disabled={lieferantenStamm.length === 0}
                        />
                        <Select
                            id="bc-pharma"
                            label={t("page.bestellung.create.pharma_contact")}
                            value={form.pharmaberaterId}
                            onChange={(e) => {
                                setForm((f) => ({
                                    ...f,
                                    vorlageInputText: "",
                                    pharmaberaterId: e.target.value,
                                }));
                            }}
                            options={pharmaOptions}
                            disabled={pharmaberaterStamm.length === 0}
                        />
                    </div>
                    {stammEmpty ? (
                        <p className="bestellung-create-form__note">{t("produkte.form.stamm_empty_hint")}</p>
                    ) : null}
                    <div className="bestellung-create-form__field bestellung-create-form__artikel-row">
                        <Select
                            id="bc-art"
                            label={t("page.bestellung.create.article_label")}
                            value={form.artikelProduktId}
                            onChange={(e) => {
                                setForm((f) => ({
                                    ...f,
                                    vorlageInputText: "",
                                    artikelProduktId: e.target.value,
                                }));
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
                            onChange={(e) => setForm((f) => ({ ...f, menge: e.target.value }))}
                        />
                        <Input
                            id="bc-einheit"
                            label={t("common.unit")}
                            placeholder={t("page.bestellung.create.unit_ph")}
                            value={form.einheit}
                            onChange={(e) => setForm((f) => ({ ...f, einheit: e.target.value }))}
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
                        onChange={(e) => setForm((f) => ({ ...f, erwartet_am: e.target.value }))}
                    />
                    <Textarea
                        id="bc-bem"
                        label={t("common.note")}
                        rows={3}
                        value={form.bemerkung}
                        onChange={(e) => setForm((f) => ({ ...f, bemerkung: e.target.value }))}
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
