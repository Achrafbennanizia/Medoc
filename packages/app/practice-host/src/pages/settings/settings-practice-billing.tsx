import type { ChangeEvent, FC } from "react";
import type { InvoicePractice } from "@/lib/invoice-service-item";
import { isValidPracticeDigitId, isValidPracticeIban } from "@/lib/invoice-service-item";
import { useT } from "@/lib/i18n";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";

const BERUF_SUGGESTIONS = [
    "enum.profession.dentist",
    "enum.profession.dentist_female",
    "enum.profession.orthodontist",
    "enum.profession.orthodontist_female",
    "enum.profession.oral_surgeon",
    "enum.profession.oral_surgeon_female",
    "enum.profession.specialist_oral_surgery",
] as const;

export type SettingsPracticeBillingProps = {
    practice: InvoicePractice;
    editing: boolean;
    onStartEdit: () => void;
    onCancel: () => void;
    onSave: () => void;
    onChange: (patch: Partial<InvoicePractice>) => void;
};

export const SettingsPracticeBillingSection: FC<SettingsPracticeBillingProps> = ({
    practice,
    editing,
    onStartEdit,
    onCancel,
    onSave,
    onChange,
}) => {
    const t = useT();
    const set = (patch: Partial<InvoicePractice>) => onChange(patch);

    return (
        <>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>{t("settings.practice.billing_title")}</b>
                    <div className="settings-row-muted">{t("settings.practice.billing_hint")}</div>
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
                        {t("settings.practice.billing_section_provider")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-clinician"
                            label={t("settings.practice.billing_clinician_name")}
                            value={practice.clinician_name ?? ""}
                            onChange={(e) => set({ clinician_name: e.target.value })}
                            placeholder={t("settings.practice.billing_clinician_placeholder")}
                        />
                        <Input
                            id="px-profession"
                            label={t("settings.practice.billing_professional_title")}
                            list="px-profession-suggestions"
                            value={practice.professional_title ?? ""}
                            onChange={(e) => set({ professional_title: e.target.value })}
                        />
                        <datalist id="px-profession-suggestions">
                            {BERUF_SUGGESTIONS.map((key) => (
                                <option key={key} value={t(key)} />
                            ))}
                        </datalist>
                        <Input
                            id="px-zanr"
                            label={t("settings.practice.billing_zanr")}
                            value={practice.zanr ?? ""}
                            onChange={(e) => set({ zanr: e.target.value })}
                            error={
                                (practice.zanr ?? "").trim() && !isValidPracticeDigitId(practice.zanr ?? "")
                                    ? t("settings.practice.billing_digits_error")
                                    : undefined
                            }
                        />
                        <Input
                            id="px-bsnr"
                            label={t("settings.practice.billing_bsnr")}
                            value={practice.bsnr ?? ""}
                            onChange={(e) => set({ bsnr: e.target.value })}
                            error={
                                (practice.bsnr ?? "").trim() && !isValidPracticeDigitId(practice.bsnr ?? "")
                                    ? t("settings.practice.billing_digits_error")
                                    : undefined
                            }
                        />
                        <Input
                            id="px-lanr"
                            label={t("settings.practice.billing_lanr")}
                            value={practice.lanr ?? ""}
                            onChange={(e) => set({ lanr: e.target.value })}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        {t("settings.practice.billing_bank_section")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-iban"
                            label={t("settings.practice.billing_iban")}
                            value={practice.bank_iban ?? ""}
                            onChange={(e) => set({ bank_iban: e.target.value })}
                            error={
                                (practice.bank_iban ?? "").trim() && !isValidPracticeIban(practice.bank_iban ?? "")
                                    ? t("settings.practice.billing_iban_error")
                                    : undefined
                            }
                        />
                        <Input id="px-bic" label={t("settings.practice.billing_bic")} value={practice.bank_bic ?? ""} onChange={(e) => set({ bank_bic: e.target.value })} />
                        <Input
                            id="px-bank"
                            label={t("settings.practice.billing_bank_name")}
                            value={practice.bank_name ?? ""}
                            onChange={(e) => set({ bank_name: e.target.value })}
                        />
                        <Input
                            id="px-account-holder"
                            label={t("settings.practice.billing_account_holder")}
                            value={practice.account_holder ?? ""}
                            onChange={(e) => set({ account_holder: e.target.value })}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        {t("settings.practice.billing_chamber_section")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input id="px-chamber" label={t("settings.practice.billing_chamber")} value={practice.chamber ?? ""} onChange={(e) => set({ chamber: e.target.value })} />
                        <Input id="px-kzv" label={t("settings.practice.billing_kzv")} value={practice.kzv ?? ""} onChange={(e) => set({ kzv: e.target.value })} />
                        <Input
                            id="px-vat-notice"
                            label={t("settings.practice.billing_vat_exempt")}
                            value={practice.vat_exemption_notice ?? t("settings.practice.billing_vat_exempt_default")}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                set({ vat_exemption_notice: e.target.value })
                            }
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        {t("settings.practice.billing_invoice_section")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-payment_terms"
                            label={t("settings.practice.billing_payment_days")}
                            type="number"
                            min={1}
                            max={90}
                            value={String(practice.payment_terms_days ?? 14)}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                const n = Number.parseInt(e.target.value, 10);
                                set({ payment_terms_days: Number.isFinite(n) && n > 0 ? n : 14 });
                            }}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        {t("settings.practice.billing_emergency_section")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-emergency"
                            label={t("settings.practice.billing_emergency_phone")}
                            type="tel"
                            value={practice.emergency_phone ?? ""}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                set({ emergency_phone: e.target.value })
                            }
                        />
                    </div>
                </div>
            ) : null}
        </>
    );
};
