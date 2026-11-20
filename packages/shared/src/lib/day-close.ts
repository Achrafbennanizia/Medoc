import type { Payment } from "@/models/types";
import { paymentCountsTowardPaid } from "./payment-booking";
import { practiceCurrency } from "./practice-currency";
import { ymdInTimeZone } from "./practice-timezone";
import { parseDbUtc } from "./utils";

/** Local date (YYYY-MM-DD) from `created_at` in the practice time zone. */

export function paymentLocalYmd(createdAt: string): string {
    const d = parseDbUtc(createdAt);
    if (Number.isNaN(d.getTime())) {
        return "";
    }
    return ymdInTimeZone(d);
}

export function filterPaymentsForLocalDay(payments: Payment[], ymd: string): Payment[] {
    return payments.filter((z) => paymentLocalYmd(z.created_at) === ymd);
}

/** Cash per capture (cash, not cancelled). */
export function sumCashDay(payments: Payment[], ymd: string): number {
    return filterPaymentsForLocalDay(payments, ymd)
        .filter((x) => paymentCountsTowardPaid(x.status) && x.payment_method === "CASH")
        .reduce((s, x) => s + x.amount, 0);
}

/** All booked revenue for the day (paid / partially paid, not cancelled). */
export function sumIncomeDay(payments: Payment[], ymd: string): number {
    return filterPaymentsForLocalDay(payments, ymd)
        .filter((x) => paymentCountsTowardPaid(x.status) && (x.status === "PAID" || x.status === "PARTIALLY_PAID"))
        .reduce((s, x) => s + x.amount, 0);
}

export function isCashUnverified(z: Payment): boolean {
    return (z.cash_verified ?? 0) !== 1;
}

export function isPostedPayment(z: Payment): boolean {
    return paymentCountsTowardPaid(z.status) && (z.status === "PAID" || z.status === "PARTIALLY_PAID");
}

/**
 * Day the money was recorded. Filling an older 0 € booking does not change
 * `created_at`; `updated_at` is that later day.
 */
export function paymentRecordedLocalYmd(payment: Payment): string {
    const created = paymentLocalYmd(payment.created_at);
    const updated = payment.updated_at ? paymentLocalYmd(payment.updated_at) : "";
    if (updated && (!created || updated > created)) return updated;
    return created;
}

/** Payments for Reception: recorded today, not yet confirmed in DayClose. */
export function filterReceptionCashQueue(payments: Payment[], ymd: string): Payment[] {
    return payments.filter(
        (z) => paymentRecordedLocalYmd(z) === ymd && isPostedPayment(z) && isCashUnverified(z),
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

/** Cash on the day-close screen, in the currency chosen under Settings → Practice. */
export function formatCashAmount(euros: number): string {
    if (!Number.isFinite(euros)) return "—";
    const currency = practiceCurrency();
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(euros);
    } catch {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(euros);
    }
}
