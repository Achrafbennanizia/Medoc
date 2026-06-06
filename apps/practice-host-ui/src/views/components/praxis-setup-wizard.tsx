import { useMemo, useState, type FC } from "react";
import {
    getInvoicePraxisFromStorage,
    saveInvoicePraxisToStorage,
    syncInvoicePraxisToAppKv,
    type InvoicePraxis,
} from "@/lib/invoice-leistung";
import { dismissPraxisSetupWizard } from "@/lib/praxis-completeness";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Textarea } from "./ui/input";

type Props = {
    open: boolean;
    onClose: () => void;
};

export const PraxisSetupWizard: FC<Props> = ({ open, onClose }) => {
    const [step, setStep] = useState(0);
    const [draft, setDraft] = useState<InvoicePraxis>(() => getInvoicePraxisFromStorage());

    const steps = useMemo(
        () => ["Praxis-Grunddaten", "Behandler & Zulassung", "Bankverbindung", "Steuerdaten", "Zusammenfassung"],
        [],
    );

    const save = async () => {
        saveInvoicePraxisToStorage(draft);
        await syncInvoicePraxisToAppKv(draft).catch(() => undefined);
        onClose();
    };

    const dismissLater = () => {
        dismissPraxisSetupWizard();
        onClose();
    };

    if (!open) return null;

    return (
        <Dialog
            open={open}
            onClose={dismissLater}
            title={`Praxis einrichten (${step + 1}/${steps.length})`}
            footer={
                <>
                    <Button type="button" variant="ghost" onClick={dismissLater}>
                        Später einrichten
                    </Button>
                    {step > 0 ? (
                        <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)}>
                            Zurück
                        </Button>
                    ) : null}
                    {step < steps.length - 1 ? (
                        <Button type="button" onClick={() => setStep((s) => s + 1)}>
                            Weiter
                        </Button>
                    ) : (
                        <Button type="button" onClick={() => void save()}>
                            Speichern
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
                    <Input label="Praxisname" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                    <Textarea label="Adresse" rows={3} value={draft.addr} onChange={(e) => setDraft({ ...draft, addr: e.target.value })} />
                    <Input label="Telefon" value={draft.telefon ?? ""} onChange={(e) => setDraft({ ...draft, telefon: e.target.value })} />
                    <Input label="E-Mail" value={draft.email ?? ""} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
                </div>
            ) : null}
            {step === 1 ? (
                <div className="grid gap-3">
                    <Input
                        label="Behandler-Name"
                        value={draft.behandler_name ?? ""}
                        onChange={(e) => setDraft({ ...draft, behandler_name: e.target.value })}
                    />
                    <Input
                        label="Berufsbezeichnung"
                        value={draft.berufsbezeichnung ?? ""}
                        onChange={(e) => setDraft({ ...draft, berufsbezeichnung: e.target.value })}
                    />
                    <Input label="ZANR" value={draft.zanr ?? ""} onChange={(e) => setDraft({ ...draft, zanr: e.target.value })} />
                    <Input label="BSNR" value={draft.bsnr ?? ""} onChange={(e) => setDraft({ ...draft, bsnr: e.target.value })} />
                </div>
            ) : null}
            {step === 2 ? (
                <div className="grid gap-3">
                    <Input label="IBAN" value={draft.bankverbindung_iban ?? ""} onChange={(e) => setDraft({ ...draft, bankverbindung_iban: e.target.value })} />
                    <Input label="BIC" value={draft.bankverbindung_bic ?? ""} onChange={(e) => setDraft({ ...draft, bankverbindung_bic: e.target.value })} />
                    <Input label="Bank" value={draft.bankverbindung_bank ?? ""} onChange={(e) => setDraft({ ...draft, bankverbindung_bank: e.target.value })} />
                </div>
            ) : null}
            {step === 3 ? (
                <div className="grid gap-3">
                    <Input label="USt-IdNr." value={draft.ust_id ?? ""} onChange={(e) => setDraft({ ...draft, ust_id: e.target.value })} />
                    <Input label="Steuernummer" value={draft.steuernummer ?? ""} onChange={(e) => setDraft({ ...draft, steuernummer: e.target.value })} />
                    <Input
                        label="USt-Befreiungshinweis"
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
                    <div>Behandler: {(draft.behandler_name ?? "").trim() || "—"}</div>
                    <div>ZANR/BSNR: {draft.zanr ?? "—"} / {draft.bsnr ?? "—"}</div>
                    <div>IBAN: {draft.bankverbindung_iban ?? "—"}</div>
                </div>
            ) : null}
        </Dialog>
    );
};
