import { describe, expect, it } from "vitest";
import { statisticsChartLabel } from "./statistics-chart-labels";
import { translateLocale } from "./i18n";

describe("statisticsChartLabel", () => {
    it("maps appointment status English and codes in ar/de/fr", () => {
        const ar = (key: string) => translateLocale("ar", key);
        expect(statisticsChartLabel("Planned", ar, "appointment_status")).toBe(ar("appointment.status.planned"));
        expect(statisticsChartLabel("NO_SHOW", ar, "appointment_status")).toBe(ar("appointment.status.no_show"));
        const de = (key: string) => translateLocale("de", key);
        expect(statisticsChartLabel("Confirmed", de, "appointment_status")).toBe(de("appointment.status.confirmed"));
        const fr = (key: string) => translateLocale("fr", key);
        expect(statisticsChartLabel("Completed", fr, "appointment_status")).toBe(fr("appointment.status.completed"));
    });

    it("maps appointment kind, payment method, and order status", () => {
        const ar = (key: string) => translateLocale("ar", key);
        expect(statisticsChartLabel("FirstVisit", ar, "appointment_kind")).toBe(ar("appointment.kind.FIRST_VISIT"));
        expect(statisticsChartLabel("CHECKUP", ar, "appointment_kind")).toBe(ar("appointment.kind.CHECKUP"));
        expect(statisticsChartLabel("Cash", ar, "payment")).toBe(ar("enum.payment_method.cash"));
        expect(statisticsChartLabel("IN_TRANSIT", ar, "order_status")).toBe(ar("page.purchase_orders.status.inTransit"));
        expect(statisticsChartLabel("Open", ar, "order_status")).toBe(ar("page.purchase_orders.status.open"));
    });

    it("maps diagnosis seed names", () => {
        const ar = (key: string) => translateLocale("ar", key);
        expect(statisticsChartLabel("Periodontitis stage I", ar, "diagnosis")).toBe(
            ar("page.statistics.chart.diagnosis.periodontitis_stage_i"),
        );
        expect(statisticsChartLabel("Gingivitis", ar, "diagnosis")).toBe(ar("page.statistics.chart.diagnosis.gingivitis"));
    });
});
