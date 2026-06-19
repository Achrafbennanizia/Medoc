import type { ChangeEvent, FC } from "react";
import type { InvoicePraxis } from "@/lib/invoice-leistung";
import { isValidPraxisDigitId, isValidPraxisIban } from "@/lib/invoice-leistung";
import { useT } from "@/lib/i18n";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";

const BERUF_SUGGESTIONS = [
    "enum.beruf.zahnarzt",
    "enum.beruf.zahnaerztin",
    "enum.beruf.kieferorthopaede",
    "enum.beruf.kieferorthopaedin",
    "enum.beruf.oralchirurg",
    "enum.beruf.oralchirurgin",
    "enum.beruf.fachzahnarzt_oralchirurgie",
] as const;

export type EinstellungenPraxisBillingProps = {
    praxis: InvoicePraxis;
    editing: boolean;
    onStartEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onChange: (patch: Partial<InvoicePraxis>) => void;
};

export const EinstellungenPraxisBillingSection: FC<EinstellungenPraxisBillingProps> = ({
    praxis,
    editing,
    onStartEdit,
    onCancel,
    onSave,
    onChange,
}) => {
    const t = useT();
    const set = (patch: Partial<InvoicePraxis>) => onChange(patch);

    return (
        <>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>{t("settings.praxis.billing_title")}</b>
                    <div className="settings-row-muted">{t("settings.praxis.billing_hint")}</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editing ? (
                        <>
                            <Button type="button" onClick={onSave}>
                                {t("common.save")}
                            </Button>
                            <Button type="button" variant="secondary" onClick={onCancel}>
                                {t("common.cancel")}
                            </Button>
                        </>
                    ) : (
                        <Button type="button" variant="secondary" onClick={onStartEdit}>
                            {t("common.edit")}
                        </Button>
                    )}
                </div>
            </div>
            {editing ? (
                <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                    <p className="card-sub" style={{ marginBottom: 12, fontWeight: 600 }}>
                        {t("settings.praxis.billing_section_provider")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-behandler"
                            label={t("settings.praxis.billing_behandler_name")}
                            value={praxis.behandler_name ?? ""}
                            onChange={(e) => set({ behandler_name: e.target.value })}
                            placeholder={t("settings.praxis.billing_behandler_placeholder")}
                        />
                        <Input
                            id="px-beruf"
                            label={t("settings.praxis.billing_beruf")}
                            list="px-beruf-suggestions"
                            value={praxis.berufsbezeichnung ?? ""}
                            onChange={(e) => set({ berufsbezeichnung: e.target.value })}
                        />
                        <datalist id="px-beruf-suggestions">
                            {BERUF_SUGGESTIONS.map((key) => (
                                <option key={key} value={t(key)} />
                            ))}
                        </datalist>
                        <Input
                            id="px-zanr"
                            label={t("settings.praxis.billing_zanr")}
                            value={praxis.zanr ?? ""}
                            onChange={(e) => set({ zanr: e.target.value })}
                            error={
                                (praxis.zanr ?? "").trim() && !isValidPraxisDigitId(praxis.zanr ?? "")
                                    ? t("settings.praxis.billing_digits_error")
                                    : undefined
                            }
                        />
                        <Input
                            id="px-bsnr"
                            label={t("settings.praxis.billing_bsnr")}
                            value={praxis.bsnr ?? ""}
                            onChange={(e) => set({ bsnr: e.target.value })}
                            error={
                                (praxis.bsnr ?? "").trim() && !isValidPraxisDigitId(praxis.bsnr ?? "")
                                    ? t("settings.praxis.billing_digits_error")
                                    : undefined
                            }
                        />
                        <Input
                            id="px-lanr"
                            label={t("settings.praxis.billing_lanr")}
                            value={praxis.lanr ?? ""}
                            onChange={(e) => set({ lanr: e.target.value })}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        {t("settings.praxis.billing_bank_section")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-iban"
                            label={t("settings.praxis.billing_iban")}
                            value={praxis.bankverbindung_iban ?? ""}
                            onChange={(e) => set({ bankverbindung_iban: e.target.value })}
                            error={
                                (praxis.bankverbindung_iban ?? "").trim() && !isValidPraxisIban(praxis.bankverbindung_iban ?? "")
                                    ? t("settings.praxis.billing_iban_error")
                                    : undefined
                            }
                        />
                        <Input id="px-bic" label={t("settings.praxis.billing_bic")} value={praxis.bankverbindung_bic ?? ""} onChange={(e) => set({ bankverbindung_bic: e.target.value })} />
                        <Input
                            id="px-bank"
                            label={t("settings.praxis.billing_bank_name")}
                            value={praxis.bankverbindung_bank ?? ""}
                            onChange={(e) => set({ bankverbindung_bank: e.target.value })}
                        />
                        <Input
                            id="px-kontoinhaber"
                            label={t("settings.praxis.billing_account_holder")}
                            value={praxis.bankverbindung_inhaber ?? ""}
                            onChange={(e) => set({ bankverbindung_inhaber: e.target.value })}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        {t("settings.praxis.billing_chamber_section")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input id="px-kammer" label={t("settings.praxis.billing_chamber")} value={praxis.kammer ?? ""} onChange={(e) => set({ kammer: e.target.value })} />
                        <Input id="px-kzv" label={t("settings.praxis.billing_kzv")} value={praxis.kzv ?? ""} onChange={(e) => set({ kzv: e.target.value })} />
                        <Input
                            id="px-ust-hinweis"
                            label={t("settings.praxis.billing_vat_exempt")}
                            value={praxis.ust_befreiung_hinweis ?? t("settings.praxis.billing_vat_exempt_default")}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                set({ ust_befreiung_hinweis: e.target.value })
                            }
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        {t("settings.praxis.billing_invoice_section")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-zahlungsziel"
                            label={t("settings.praxis.billing_payment_days")}
                            type="number"
                            min={1}
                            max={90}
                            value={String(praxis.zahlungsziel_tage ?? 14)}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const n = Number.parseInt(e.target.value, 10);
                                set({ zahlungsziel_tage: Number.isFinite(n) && n > 0 ? n : 14 });
                            }}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        {t("settings.praxis.billing_emergency_section")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-notfall"
                            label={t("settings.praxis.billing_emergency_phone")}
                            type="tel"
                            value={praxis.notfall_telefon ?? ""}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                set({ notfall_telefon: e.target.value })
                            }
                        />
                    </div>
                </div>
            ) : null}
        </>
    );
};
