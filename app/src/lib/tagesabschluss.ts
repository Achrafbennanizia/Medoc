import type { Zahlung } from "@/models/types";

/** Ortszeit-Datum (YYYY-MM-DD) aus `created_at` (SQLite-naiv oder ISO). */
export function zahlungLocalYmd(createdAt: string): string {
    const t = createdAt.trim();
    const iso = t.includes("T") ? t : t.replace(" ", "T");
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return "";
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function isStorniert(z: Zahlung): boolean {
    return z.status === "STORNIERT";
}

export function filterZahlungenForLocalDay(zahlungen: Zahlung[], ymd: string): Zahlung[] {
    return zahlungen.filter((z) => zahlungLocalYmd(z.created_at) === ymd);
}

/** Bargeld laut Erfassung (Bar, nicht storniert). */
export function sumBarTag(zahlungen: Zahlung[], ymd: string): number {
    return filterZahlungenForLocalDay(zahlungen, ymd)
        .filter((x) => !isStorniert(x) && x.zahlungsart === "BAR")
        .reduce((s, x) => s + x.betrag, 0);
}

/** Sämtliche verbuchte Einnahmen des Tages (bezahlt / teilbezahlt, nicht storniert). */
export function sumEinnahmenTag(zahlungen: Zahlung[], ymd: string): number {
    return filterZahlungenForLocalDay(zahlungen, ymd)
        .filter((x) => !isStorniert(x) && (x.status === "BEZAHLT" || x.status === "TEILBEZAHLT"))
        .reduce((s, x) => s + x.betrag, 0);
}

export const AMOUNT_TOL = 0.01;

export function amountsMatch(a: number, b: number): boolean {
    return Math.abs(a - b) < AMOUNT_TOL;
}

export function parseEuroInput(raw: string): number | null {
    const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
}
