import { describe, expect, it } from "vitest";
import { buildStatisticsReportBundle, reportBundleToJson, reportBundleToXml } from "./report-export";
import { parseReportBundleJson, parseReportBundleXml } from "./report-import";
import type { StatisticsOverview } from "@/models/types";

const minimalStats: StatisticsOverview = {
    patients_total: 10,
    new_patients_per_month: [],
    patients_cumulative_per_month: [],
    age_groups: [],
    sexes: [],
    patient_status: [],
    treatments_by_category: [],
    treatments_per_month: [],
    disease_patterns_top: [],
    disease_patterns_monthly: [],
    medications_top: [],
    appointments_per_month: [],
    appointment_status: [],
    appointment_kind: [],
    income_per_month: [{ month: "2026-05", value: 1000 }],
    revenue_by_payment_method: [],
    income_current_month: 1000,
    orders_by_status: [],
    orders_per_month: [],
    products_low: 0,
};

describe("report import round-trip", () => {
    it("JSON export → parse preserves docTitle and sections", () => {
        const bundle = buildStatisticsReportBundle(minimalStats, "6m");
        const parsed = parseReportBundleJson(reportBundleToJson(bundle));
        expect(parsed.docTitle).toBe(bundle.docTitle);
        expect(parsed.sections.length).toBe(bundle.sections.length);
        expect(parsed.summary.length).toBeGreaterThan(0);
    });

    it("XML export → parse preserves title", () => {
        const bundle = buildStatisticsReportBundle(minimalStats, "12m");
        const parsed = parseReportBundleXml(reportBundleToXml(bundle));
        expect(parsed.docTitle).toBe(bundle.docTitle);
        expect(parsed.sections[0]?.title).toBe(bundle.sections[0]?.title);
    });
});
