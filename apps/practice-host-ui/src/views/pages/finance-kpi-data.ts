/** Pure helpers for the finance KPI row and list filters. */
import type { PaymentFinanceKpis } from "@/systems/practice-host/controllers/payment.controller";

export type FinanceTxTab = "all" | "income" | "expense";

export function formatPctLocalized(pct: number, locale: string): string {
    const s = (pct >= 0 ? "+" : "") + Math.abs(pct).toFixed(1).replace(".", locale.startsWith("de") ? "," : ".");
    return s + "%";
}

export function paymentStatusFilter(tab: FinanceTxTab): string | undefined {
    if (tab === "income") return "PAID,PARTIALLY_PAID";
    if (tab === "expense") return "CANCELLED";
    return undefined;
}

export function kpisFromServer(k: PaymentFinanceKpis) {
    const incomeMtd = k.incomeMtd;
    const st = k.cancelledMtd;
    const incomeDeltaPct =
        k.incomePrevMtd > 0
            ? ((incomeMtd - k.incomePrevMtd) / k.incomePrevMtd) * 100
            : incomeMtd > 0 && k.incomePrevMtd === 0
              ? 100
              : null;
    const stDeltaPct =
        k.cancelledPrevMtd > 0
            ? ((st - k.cancelledPrevMtd) / k.cancelledPrevMtd) * 100
            : st > 0
              ? 100
              : st === 0 && k.cancelledPrevMtd === 0
                ? null
                : 0;
    return {
        incomeMtd,
        incomeDeltaPct,
        st,
        stDeltaPct,
        openCount: k.openCount,
        openSum: k.openSum,
        profitMtd: incomeMtd - st,
        cancelledPrevMtd: k.cancelledPrevMtd,
    };
}
