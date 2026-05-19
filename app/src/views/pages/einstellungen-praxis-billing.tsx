import type { FC } from "react";
import type { InvoicePraxis } from "@/lib/invoice-leistung";
import { isValidPraxisDigitId, isValidPraxisIban } from "@/lib/invoice-leistung";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

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
    const set = (patch: Partial<InvoicePraxis>) => onChange(patch);

    return (
        <>
            <div className="settings-row" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <b>Rechnungs-Stammdaten</b>
                    <div className="settings-row-muted">Behandler, Zulassung, Bank, Standesrecht — für Rechnungen &amp; Rezepte</div>
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", flex: "0 1 auto" }}>
                    {editing ? (
                        <>
                            <Button type="button" onClick={onSave}>
                                Speichern
                            </Button>
                            <Button type="button" variant="secondary" onClick={onCancel}>
                                Abbrechen
                            </Button>
                        </>
                    ) : (
                        <Button type="button" variant="secondary" onClick={onStartEdit}>
                            Bearbeiten
                        </Button>
                    )}
                </div>
            </div>
            {editing ? (
                <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
                    <p className="card-sub" style={{ marginBottom: 12, fontWeight: 600 }}>
                        Behandler &amp; Zulassung
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-behandler"
                            label="Behandler-Name"
                            value={praxis.behandler_name ?? ""}
                            onChange={(e) => set({ behandler_name: e.target.value })}
                            placeholder="Dr. Max Mustermann"
                        />
                        <Input
                            id="px-beruf"
                            label="Berufsbezeichnung"
                            list="px-beruf-suggestions"
                            value={praxis.berufsbezeichnung ?? ""}
                            onChange={(e) => set({ berufsbezeichnung: e.target.value })}
                        />
                        <datalist id="px-beruf-suggestions">
                            <option value="Zahnarzt" />
                            <option value="Zahnärztin" />
                            <option value="Kieferorthopäde" />
                            <option value="Kieferorthopädin" />
                            <option value="Oralchirurg" />
                            <option value="Oralchirurgin" />
                            <option value="Fachzahnarzt für Oralchirurgie" />
                        </datalist>
                        <Input
                            id="px-zanr"
                            label="ZANR (Zahnarztnummer)"
                            value={praxis.zanr ?? ""}
                            onChange={(e) => set({ zanr: e.target.value })}
                            error={(praxis.zanr ?? "").trim() && !isValidPraxisDigitId(praxis.zanr ?? "") ? "Genau 9 Ziffern" : undefined}
                        />
                        <Input
                            id="px-bsnr"
                            label="BSNR (Betriebsstättennr.)"
                            value={praxis.bsnr ?? ""}
                            onChange={(e) => set({ bsnr: e.target.value })}
                            error={(praxis.bsnr ?? "").trim() && !isValidPraxisDigitId(praxis.bsnr ?? "") ? "Genau 9 Ziffern" : undefined}
                        />
                        <Input
                            id="px-lanr"
                            label="LANR (falls abweichend)"
                            value={praxis.lanr ?? ""}
                            onChange={(e) => set({ lanr: e.target.value })}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        Bankverbindung
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-iban"
                            label="IBAN"
                            value={praxis.bankverbindung_iban ?? ""}
                            onChange={(e) => set({ bankverbindung_iban: e.target.value })}
                            error={
                                (praxis.bankverbindung_iban ?? "").trim() && !isValidPraxisIban(praxis.bankverbindung_iban ?? "")
                                    ? "Ungültiges IBAN-Format"
                                    : undefined
                            }
                        />
                        <Input id="px-bic" label="BIC" value={praxis.bankverbindung_bic ?? ""} onChange={(e) => set({ bankverbindung_bic: e.target.value })} />
                        <Input
                            id="px-bank"
                            label="Bankname"
                            value={praxis.bankverbindung_bank ?? ""}
                            onChange={(e) => set({ bankverbindung_bank: e.target.value })}
                        />
                        <Input
                            id="px-kontoinhaber"
                            label="Kontoinhaber (falls abweichend)"
                            value={praxis.bankverbindung_inhaber ?? ""}
                            onChange={(e) => set({ bankverbindung_inhaber: e.target.value })}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        Standesrecht
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input id="px-kammer" label="Zahnärztekammer" value={praxis.kammer ?? ""} onChange={(e) => set({ kammer: e.target.value })} />
                        <Input id="px-kzv" label="KZV" value={praxis.kzv ?? ""} onChange={(e) => set({ kzv: e.target.value })} />
                        <Input
                            id="px-ust-hinweis"
                            label="USt-Befreiungshinweis"
                            value={praxis.ust_befreiung_hinweis ?? "Umsatzsteuerbefreit gem. § 4 Nr. 14 UStG"}
                            onChange={(e) => set({ ust_befreiung_hinweis: e.target.value })}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        Rechnungswesen
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-zahlungsziel"
                            label="Zahlungsziel (Tage)"
                            type="number"
                            min={1}
                            max={90}
                            value={String(praxis.zahlungsziel_tage ?? 14)}
                            onChange={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                set({ zahlungsziel_tage: Number.isFinite(n) && n > 0 ? n : 14 });
                            }}
                        />
                    </div>
                    <p className="card-sub" style={{ margin: "16px 0 12px", fontWeight: 600 }}>
                        Notfall
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input
                            id="px-notfall"
                            label="Notfall-Telefon"
                            type="tel"
                            value={praxis.notfall_telefon ?? ""}
                            onChange={(e) => set({ notfall_telefon: e.target.value })}
                        />
                    </div>
                </div>
            ) : null}
        </>
    );
};
