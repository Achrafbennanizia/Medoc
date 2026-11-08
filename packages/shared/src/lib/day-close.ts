import type { Payment } from "@/models/types";

/** Local date (YYYY-MM-DD) from `created_at` (SQLite-naive or ISO). */
/**
 * F77: database timestamps (`YYYY-MM-DD HH:MM:SS`, SQLite CURRENT_TIMESTAMP)
 * are UTC. Without a zone designator `new Date()` would read them as local
 * time, which moves payments near midnight to the wrong day.
 */
export function parseDbUtc(raw: string): Date {
    const t = raw.trim();
    const iso = t.includes("T") ? t : t.replace(" ", "T");
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso);
    return new Date(hasZone ? iso : `${iso}Z`);
}

export function paymentLocalYmd(createdAt: string): string {
    const d = parseDbUtc(createdAt);
    if (Number.isNaN(d.getTime())) {
        return "";
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function isCancelled(z: Payment): boolean {
    return z.status === "CANCELLED";
}

export function filterPaymentsForLocalDay(payments: Payment[], ymd: string): Payment[] {
    return payments.filter((z) => paymentLocalYmd(z.created_at) === ymd);
}

/** Cash per capture (cash, not cancelled). */
export function sumCashDay(payments: Payment[], ymd: string): number {
    return filterPaymentsForLocalDay(payments, ymd)
        .filter((x) => !isCancelled(x) && x.payment_method === "CASH")
        .reduce((s, x) => s + x.amount, 0);
}

/** All booked revenue for the day (paid / partially paid, not cancelled). */
export function sumIncomeDay(payments: Payment[], ymd: string): number {
    return filterPaymentsForLocalDay(payments, ymd)
        .filter((x) => !isCancelled(x) && (x.status === "PAID" || x.status === "PARTIALLY_PAID"))
        .reduce((s, x) => s + x.amount, 0);
}

export function isCashUnverified(z: Payment): boolean {
    return (z.cash_verified ?? 0) !== 1;
}

export function isPostedPayment(z: Payment): boolean {
    return !isCancelled(z) && (z.status === "PAID" || z.status === "PARTIALLY_PAID");
}

/** Payments for Reception: recorded today, not yet confirmed in DayClose. */
export function filterReceptionCashQueue(payments: Payment[], ymd: string): Payment[] {
    return payments.filter(
        (z) => paymentLocalYmd(z.created_at) === ymd && isPostedPayment(z) && isCashUnverified(z),
    );
}

export function filterReceptionCashQueueOlder(payments: Payment[], beforeYmd: string): Payment[] {
    return payments.filter(
        (z) => {
            const d = paymentLocalYmd(z.created_at);
            return d !== "" && d < beforeYmd && isPostedPayment(z) && isCashUnverified(z);
        },
    );
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
