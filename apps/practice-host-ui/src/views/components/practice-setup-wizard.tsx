import { useT, useTParams } from "@/lib/i18n";
import { useMemo, useState, type FC } from "react";
import {
    getInvoicePracticeFromStorage,
    saveInvoicePracticeToStorage,
    syncInvoicePracticeToAppKv,
    type InvoicePractice,
} from "@/lib/invoice-service-item";
import { PRACTICE_COUNTRIES, practiceCountry } from "@/lib/document-header-layout";
import { dismissPracticeSetupWizard } from "@/lib/practice-completeness";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Select, Textarea } from "./ui/input";

type Props = {
    open: boolean;
    onClose: () => void;
};

export const PracticeSetupWizard: FC<Props> = ({ open, onClose }) => {
    const t = useT();
    const tp = useTParams();
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState<InvoicePractice>(() => getInvoicePracticeFromStorage());
    // The country decides which ids the documents print, so later steps ask only for those.
    const country = practiceCountry(draft);
    const text = (key: keyof InvoicePractice) => (typeof draft[key] === "string" ? (draft[key] as string) : "");
    const field = (key: keyof InvoicePractice, labelKey: string) => (
        <Input key={key} label={t(labelKey)} value={text(key)} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
    );

    const steps = useMemo(
        () => [
            t("practice.setup.step_basics"),
            t("practice.setup.step_provider"),
            t("practice.setup.step_bank"),
            t("practice.setup.step_tax"),
            t("practice.setup.step_summary"),
        ],
        [t],
    );

    const save = async () => {
        saveInvoicePracticeToStorage(draft);
        await syncInvoicePracticeToAppKv(draft).catch(() => undefined);
        onClose();
    };

    const dismissLater = () => {
        dismissPracticeSetupWizard();
        onClose();
    };

    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={dismissLater}
            title={tp("practice.setup.title", { step: step + 1, total: steps.length })}
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={dismissLater}>
                        {t("practice.setup.later")}
                    </Button>
                    {step > 0 ? (
                        <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
                            {t("common.back")}
                        </Button>
                    ) : null}
                    {step < steps.length - 1 ? (
                        <Button type="button" onClick={() => setStep((s) => s + 1)}>
                            {t("common.next")}
                        </Button>
                    ) : (
                        <Button type="button" onClick={() => void save()}>
                            {t("common.save")}
                        </Button>
                    )}
                </>
            }
        >
            <p className="card-sub" style={{ marginTop: 0 }}>
                {steps[step]}
            </p>
            {step === 0 ? (
                <div className="grid gap-3">
                    <Select
                        label={t("settings.practice.country")}
                        hint={t("practice.setup.country_hint")}
                        value={draft.country ?? country}
                        options={PRACTICE_COUNTRIES.map((code) => ({ value: code, label: t(`settings.practice.country_${code}`) }))}
                        onChange={(e) => {
                            const next = e.target.value;
                            setDraft({ ...draft, country: next, currency: next === "MA" ? "MAD" : "EUR" });
                        }}
                    />
                    <Input label={t("practice.setup.practice_name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    <Textarea label={t("practice.setup.address")} rows={3} value={draft.addr} onChange={(e) => setDraft({ ...draft, addr: e.target.value })} />
                    <Input type="tel" label={t("practice.setup.phone")} value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                    <Input label={t("practice.setup.email")} value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </div>
            ) : null}
            {step === 1 ? (
                <div className="grid gap-3">
                    <Input
                        label={t("practice.setup.clinician")}
                        value={draft.clinician_name ?? ""}
                        onChange={(e) => setDraft({ ...draft, clinician_name: e.target.value })}
                    />
                    <Input
                        label={t("practice.setup.professional_title")}
                        value={draft.professional_title ?? ""}
                        onChange={(e) => setDraft({ ...draft, professional_title: e.target.value })}
                    />
                    {country === "DE" ? [field("zanr", "practice.setup.zanr"), field("bsnr", "practice.setup.bsnr")] : null}
                    {country === "FR"
                        ? [field("fr_rpps", "settings.practice.billing_fr_rpps"), field("fr_siret", "settings.practice.billing_fr_siret")]
                        : null}
                    {country === "MA"
                        ? [
                              field("ma_inpe", "settings.practice.billing_ma_inpe"),
                              field("ma_ice", "settings.practice.billing_ma_ice"),
                              field("ma_if", "settings.practice.billing_ma_if"),
                              field("ma_tp", "settings.practice.billing_ma_tp"),
                              field("ma_rc", "settings.practice.billing_ma_rc"),
                              field("ma_cnss", "settings.practice.billing_ma_cnss"),
                          ]
                        : null}
                </div>
            ) : null}
            {step === 2 ? (
                <div className="grid gap-3">
                    <Input label={t("practice.setup.iban")} value={draft.bank_iban ?? ""} onChange={(e) => setDraft({ ...draft, bank_iban: e.target.value })} />
                    <Input label={t("practice.setup.bic")} value={draft.bank_bic ?? ""} onChange={(e) => setDraft({ ...draft, bank_bic: e.target.value })} />
                    <Input label={t("practice.setup.bank")} value={draft.bank_name ?? ""} onChange={(e) => setDraft({ ...draft, bank_name: e.target.value })} />
                </div>
            ) : null}
            {step === 3 ? (
                <div className="grid gap-3">
                    {/* In Morocco the tax ids (ICE, IF) were asked in the previous step. */}
                    {country === "MA" ? null : [field("vat_id", "practice.setup.tax_id"), field("tax_number", "practice.setup.tax_number")]}
                    <Input
                        label={t("practice.setup.tax_exempt")}
                        value={draft.vat_exemption_notice ?? ""}
                        onChange={(e) => setDraft({ ...draft, vat_exemption_notice: e.target.value })}
                    />
                </div>
            ) : null}
            {step === 4 ? (
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                    <div>
                        <strong>{draft.name}</strong>
                    </div>
                    <pre style={{ whiteSpace: "pre-wrap", margin: "8px 0" }}>{draft.addr}</pre>
                    <div>
                        {tp("practice.setup.summary_clinician", {
                            name: (draft.clinician_name ?? "").trim() || t("common.dash"),
                        })}
                    </div>
                    <div>{t(`settings.practice.country_${country}`)}</div>
                    {country === "DE" ? (
                        <div>
                            {tp("practice.setup.summary_zanr_bsnr", {
                                zanr: draft.zanr ?? t("common.dash"),
                                bsnr: draft.bsnr ?? t("common.dash"),
                            })}
                        </div>
                    ) : null}
                    {country === "MA" ? (
                        <div>
                            {[["ICE", draft.ma_ice], ["IF", draft.ma_if], ["INPE", draft.ma_inpe]]
                                .map(([k, v]) => `${k} ${(v ?? "").trim() || t("common.dash")}`)
                                .join(" · ")}
                        </div>
                    ) : null}
                    <div>{tp("practice.setup.summary_iban", { iban: draft.bank_iban ?? t("common.dash") })}</div>
                </div>
            ) : null}
        </Dialog>
    );
};
