import { formatCurrency } from "@/lib/utils";

/** Kostenperiode laut Eingabe (Betrag bezieht sich genau auf diesen Rhythmus). */
export type VertragIntervall = "TAG" | "WOCHE" | "MONAT" | "JAHR";

export const VERTRAG_INTERVALL_OPTIONS: { value: VertragIntervall; label: string }[] = [
    { value: "TAG", label: "pro Tag" },
    { value: "WOCHE", label: "pro Woche" },
    { value: "MONAT", label: "pro Monat" },
    { value: "JAHR", label: "pro Jahr" },
];

export type VertragItem = {
    id: string;
    bezeichnung: string;
    partner: string;
    /** Betrag je `intervall` (0 = bewusst variabel, siehe z. B. Notiz in Partner) */
    betrag: number;
    intervall: VertragIntervall;
    /** true = kein fester Laufzeitraum; `periodeVon/Bis` werden ignoriert. */
    unbefristet: boolean;
    periodeVon: string | null;
    periodeBis: string | null;
    createdAt: string;
};

export function intervallKurz(i: VertragIntervall): string {
    switch (i) {
        case "TAG":
            return "Tag";
        case "WOCHE":
            return "Wo.";
        case "MONAT":
            return "Mon.";
        case "JAHR":
            return "Jahr";
        default:
            return i;
    }
}

/** Richtwert: ungefährer Monatsansatz (für Tabelle/Überblick). */
export function betragAequivalentProMonat(betrag: number, intervall: VertragIntervall): number {
    if (betrag <= 0) return 0;
    switch (intervall) {
        case "TAG":
            return betrag * (365.25 / 12);
        case "WOCHE":
            return betrag * (365.25 / 12 / 7);
        case "MONAT":
            return betrag;
        case "JAHR":
            return betrag / 12;
        default:
            return betrag;
    }
}

export function heuteYmd(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/** Läuft der Vertrag heute? (Kündigung / Ablaufdatum) */
export function vertragAktivHeute(v: VertragItem): boolean {
    if (v.unbefristet) return true;
    const von = v.periodeVon;
    const bis = v.periodeBis;
    if (!von || !bis) return true;
    const t = heuteYmd();
    return t >= von && t <= bis;
}

export function formatVertragLaufzeit(v: VertragItem): string {
    if (v.unbefristet) return "unbefristet";
    if (v.periodeVon && v.periodeBis) return `${v.periodeVon} – ${v.periodeBis}`;
    if (v.periodeVon) return `ab ${v.periodeVon}`;
    if (v.periodeBis) return `bis ${v.periodeBis}`;
    return "—";
}

export function formatVertragbetragzeile(betrag: number, intervall: VertragIntervall): string {
    if (betrag <= 0) return "variabel";
    return `${formatCurrency(betrag)} / ${intervallKurz(intervall)}`;
}

export function formatMonatsaequivalenzText(v: VertragItem): string {
    if (v.betrag <= 0) return "—";
    const m = betragAequivalentProMonat(v.betrag, v.intervall);
    return `≈ ${formatCurrency(m)} / Monat (Richtwert)`;
}
