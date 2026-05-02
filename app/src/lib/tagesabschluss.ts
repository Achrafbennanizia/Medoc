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

/**
 * Parse German / mixed numeric input for Euro amounts.
 * - `1.234,56` → 1234.56 (`.` thousands, `,` decimal)
 * - `1234,56` → 1234.56
 * - `1.234.567` (only dots as thousands) → 1234567
 * - `12.34` with a single dot and no comma → decimal point (en-US style)
 */
export function parseEuroInput(raw: string): number | null {
    const s0 = String(raw).trim().replace(/\s/g, "");
    if (s0 === "") return null;

    let s = s0;
    if (s.includes(",")) {
        s = s.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
        s = s.replace(/\./g, "");
    }

    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
}
