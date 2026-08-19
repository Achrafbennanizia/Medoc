import { useT, useTParams } from "@/lib/i18n";
import { useMemo, useState, type FC } from "react";
import {
    getInvoicePracticeFromStorage,
    saveInvoicePracticeToStorage,
    syncInvoicePracticeToAppKv,
    type InvoicePractice,
} from "@/lib/invoice-service-item";
import { dismissPracticeSetupWizard } from "@/lib/practice-completeness";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";

type Props = {
    open: boolean;
    onClose: () => void;
};

export const PracticeSetupWizard: FC<Props> = ({ open, onClose }) => {
    const t = useT();
    const tp = useTParams();
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState<InvoicePractice>(() => getInvoicePracticeFromStorage());

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
                    <Input label={t("practice.setup.practice_name")} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    <Textarea label={t("practice.setup.address")} rows={3} value={draft.addr} onChange={(e) => setDraft({ ...draft, addr: e.target.value })} />
                    <Input label={t("practice.setup.phone")} value={draft.phone ?? ""} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
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
                    <Input label={t("practice.setup.zanr")} value={draft.zanr ?? ""} onChange={(e) => setDraft({ ...draft, zanr: e.target.value })} />
                    <Input label={t("practice.setup.bsnr")} value={draft.bsnr ?? ""} onChange={(e) => setDraft({ ...draft, bsnr: e.target.value })} />
                </div>
            ) : null}
            {step === 2 ? (
                <div className="grid gap-3">
                    <Input label={t("practice.setup.iban")} value={draft.bankverbindung_iban ?? ""} onChange={(e) => setDraft({ ...draft, bankverbindung_iban: e.target.value })} />
                    <Input label={t("practice.setup.bic")} value={draft.bankverbindung_bic ?? ""} onChange={(e) => setDraft({ ...draft, bankverbindung_bic: e.target.value })} />
                    <Input label={t("practice.setup.bank")} value={draft.bankverbindung_bank ?? ""} onChange={(e) => setDraft({ ...draft, bankverbindung_bank: e.target.value })} />
                </div>
            ) : null}
            {step === 3 ? (
                <div className="grid gap-3">
                    <Input label={t("practice.setup.tax_id")} value={draft.ust_id ?? ""} onChange={(e) => setDraft({ ...draft, ust_id: e.target.value })} />
                    <Input label={t("practice.setup.tax_number")} value={draft.tax_number ?? ""} onChange={(e) => setDraft({ ...draft, tax_number: e.target.value })} />
                    <Input
                        label={t("practice.setup.tax_exempt")}
                        value={draft.ust_befreiung_hinweis ?? ""}
                        onChange={(e) => setDraft({ ...draft, ust_befreiung_hinweis: e.target.value })}
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
                    <div>
                        {tp("practice.setup.summary_zanr_bsnr", {
                            zanr: draft.zanr ?? t("common.dash"),
                            bsnr: draft.bsnr ?? t("common.dash"),
                        })}
                    </div>
                    <div>{tp("practice.setup.summary_iban", { iban: draft.bankverbindung_iban ?? t("common.dash") })}</div>
                </div>
            ) : null}
        </Dialog>
    );
};
