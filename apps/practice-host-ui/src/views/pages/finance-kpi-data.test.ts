import { describe, expect, it } from "vitest";
import { formatPctLocalized, kpisFromServer, paymentStatusFilter } from "./finance-kpi-data";

const k = (o: Partial<Parameters<typeof kpisFromServer>[0]> = {}) =>
    ({ incomeMtd: 0, incomePrevMtd: 0, cancelledMtd: 0, cancelledPrevMtd: 0, openCount: 0, openSum: 0, ...o }) as Parameters<
        typeof kpisFromServer
    >[0];

describe("finance KPI helpers", () => {
    it("maps the list tab to the payment status filter", () => {
        expect(paymentStatusFilter("all")).toBeUndefined();
        expect(paymentStatusFilter("income")).toBe("PAID,PARTIALLY_PAID");
        expect(paymentStatusFilter("expense")).toBe("CANCELLED");
    });

    it("computes month deltas, including the empty previous month", () => {
        expect(kpisFromServer(k({ incomeMtd: 150, incomePrevMtd: 100 })).incomeDeltaPct).toBe(50);
        expect(kpisFromServer(k({ incomeMtd: 50, incomePrevMtd: 0 })).incomeDeltaPct).toBe(100);
        expect(kpisFromServer(k()).incomeDeltaPct).toBeNull();
        expect(kpisFromServer(k()).stDeltaPct).toBeNull();
        expect(kpisFromServer(k({ cancelledMtd: 0, cancelledPrevMtd: 10 })).stDeltaPct).toBe(-100);
        expect(kpisFromServer(k({ incomeMtd: 300, cancelledMtd: 40 })).profitMtd).toBe(260);
    });

    it("formats the percentage with a sign and the locale's decimal mark", () => {
        expect(formatPctLocalized(12.34, "en")).toBe("+12.3%");
        // Negative values carry no minus: the caller shows a ↓ arrow instead.
        expect(formatPctLocalized(-5, "de")).toBe("5,0%");
        expect(formatPctLocalized(0, "fr")).toBe("+0.0%");
    });
});
