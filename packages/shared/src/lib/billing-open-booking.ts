/**
 * FA-LEIST-06 — mirrors `pricing::behandlung_has_billable_leistung` + patient-detail UX.
 */
import type { ZahlungsArt } from "@/models/types";
import type { PatientDetailAkteTab } from "@/lib/patient-detail-utils";

/** FA-LEIST-06/07 — same rule for Behandlung and Untersuchung. */
export function behandlungHasBillableLeistung(
    leistungsname: string | null | undefined,
    gesamtkosten: number | null | undefined,
): boolean {
    if ((leistungsname ?? "").trim().length > 0) return true;
    const g = gesamtkosten;
    return g != null && Number.isFinite(g) && g > 0.005;
}

export const untersuchungHasBillableLeistung = behandlungHasBillableLeistung;

export type ZahlNewFormState = {
    linkKind: "" | "behand" | "unter";
    linkId: string;
    betrag: string;
    zahlungsart: ZahlungsArt;
    beschreibung: string;
};

export type OpenZahlTabAfterBehandlungArgs = {
    behandlungId: string;
    gesamtkosten: number | null;
    goTab: (tab: PatientDetailAkteTab) => void;
    setShowZahlComposer: (show: boolean) => void;
    setZahlNewForm: (form: ZahlNewFormState) => void;
};

/** Patient Akte → billing tab, form "Neue Buchung" pre-filled. */
export function openZahlTabAfterBillableBehandlung(args: OpenZahlTabAfterBehandlungArgs): void {
    const betrag =
        args.gesamtkosten != null && Number.isFinite(args.gesamtkosten) && args.gesamtkosten > 0
            ? String(args.gesamtkosten)
            : "";
    args.goTab("zahl");
    args.setZahlNewForm({
        linkKind: "behand",
        linkId: args.behandlungId,
        betrag,
        zahlungsart: "BAR",
        beschreibung: "",
    });
    args.setShowZahlComposer(true);
}

export type OpenZahlTabAfterUntersuchungArgs = {
    untersuchungId: string;
    gesamtkosten: number | null;
    goTab: (tab: PatientDetailAkteTab) => void;
    setShowZahlComposer: (show: boolean) => void;
    setZahlNewForm: (form: ZahlNewFormState) => void;
};

export function openZahlTabAfterBillableUntersuchung(args: OpenZahlTabAfterUntersuchungArgs): void {
    const betrag =
        args.gesamtkosten != null && Number.isFinite(args.gesamtkosten) && args.gesamtkosten > 0
            ? String(args.gesamtkosten)
            : "";
    args.goTab("zahl");
    args.setZahlNewForm({
        linkKind: "unter",
        linkId: args.untersuchungId,
        betrag,
        zahlungsart: "BAR",
        beschreibung: "",
    });
    args.setShowZahlComposer(true);
}
