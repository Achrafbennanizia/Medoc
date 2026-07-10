import { useId } from "react";
import type { ProduktForm } from "@/lib/produkt-form-model";
import { PRODUKT_STOCK_UI_ENABLED } from "@/lib/catalog-menu-flags";
import { useT } from "@/lib/i18n";
import { Input, Select, Textarea } from "./ui/input";

export type ProduktStammOption = { id: string; name: string };

export function ProduktFormFields({
    form,
    setForm,
    idPrefix,
    kategorieVorschlaege,
    showStammLink = false,
    lieferanten = [],
    pharmaberater = [],
}: {
    form: ProduktForm;
    setForm: (f: ProduktForm | ((p: ProduktForm) => ProduktForm)) => void;
    idPrefix: string;
    kategorieVorschlaege: string[];
    /** Supplier + pharma contact — shown on “New product” only. */
    showStammLink?: boolean;
    lieferanten?: ProduktStammOption[];
    pharmaberater?: ProduktStammOption[];
}) {
    const t = useT();
    const kategorieDatalistId = useId();
    const stammPlaceholder = t("page.bestellstamm.select_placeholder");
    const liefOptions = [
        { value: "", label: stammPlaceholder },
        ...lieferanten.map((x) => ({ value: x.id, label: x.name })),
    ];
    const kontaktOptions = [
        { value: "", label: stammPlaceholder },
        ...pharmaberater.map((x) => ({ value: x.id, label: x.name })),
    ];
    return (
        <>
            <Input
                id={`${idPrefix}-name`}
                label={t("common.name")}
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            <div>
                <Input
                    id={`${idPrefix}-kat`}
                    label={t("common.category")}
                    value={form.kategorie}
                    list={kategorieDatalistId}
                    autoComplete="off"
                    onChange={(e) => setForm((p) => ({ ...p, kategorie: e.target.value }))}
                />
                <datalist id={kategorieDatalistId}>
                    {kategorieVorschlaege.map((k) => (
                        <option key={k} value={k} />
                    ))}
                </datalist>
            </div>
            <Input
                id={`${idPrefix}-preis`}
                type="number"
                min={0}
                step="0.01"
                label={t("common.price_eur")}
                value={form.preis}
                onChange={(e) => setForm((p) => ({ ...p, preis: e.target.value }))}
            />
            {PRODUKT_STOCK_UI_ENABLED ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                        id={`${idPrefix}-bestand`}
                        type="number"
                        label={t("common.stock")}
                        value={form.bestand}
                        onChange={(e) => setForm((p) => ({ ...p, bestand: e.target.value }))}
                    />
                    <Input
                        id={`${idPrefix}-mindest`}
                        type="number"
                        label={t("common.min_stock")}
                        value={form.mindestbestand}
                        onChange={(e) => setForm((p) => ({ ...p, mindestbestand: e.target.value }))}
                    />
                </div>
            ) : (
                <Input
                    id={`${idPrefix}-amount`}
                    type="number"
                    min={0}
                    step={1}
                    label={t("produkte.form.amount")}
                    value={form.bestand}
                    onChange={(e) => setForm((p) => ({ ...p, bestand: e.target.value }))}
                />
            )}
            {showStammLink ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Select
                            id={`${idPrefix}-lief`}
                            label={t("common.supplier")}
                            value={form.lieferantId}
                            onChange={(e) => setForm((p) => ({ ...p, lieferantId: e.target.value }))}
                            options={liefOptions}
                            disabled={lieferanten.length === 0}
                        />
                        <Select
                            id={`${idPrefix}-kontakt`}
                            label={t("page.bestellstamm.contact_label")}
                            value={form.pharmaberaterId}
                            onChange={(e) => setForm((p) => ({ ...p, pharmaberaterId: e.target.value }))}
                            options={kontaktOptions}
                            disabled={pharmaberater.length === 0}
                        />
                    </div>
                    {lieferanten.length === 0 || pharmaberater.length === 0 ? (
                        <p className="ui-field-hint" style={{ marginTop: -4 }}>
                            {t("produkte.form.stamm_empty_hint")}
                        </p>
                    ) : null}
                </>
            ) : null}
            <Textarea
                id={`${idPrefix}-beschr`}
                label={t("common.description")}
                rows={3}
                value={form.beschreibung}
                onChange={(e) => setForm((p) => ({ ...p, beschreibung: e.target.value }))}
            />
        </>
    );
}
