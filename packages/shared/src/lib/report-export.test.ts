import { describe, expect, it } from "vitest";
import {
    buildAuditReportBundleFromCsv,
    buildBalanceSheetReportBundle,
    buildFinanceReportBundle,
    buildStatisticsReportBundle,
    reportBundleToCsv,
    reportBundleToJson,
    reportBundleToXml,
    reportFilename,
} from "./report-export";
import type { BalanceSheet, StatisticsOverview } from "@/models/types";

const minimalStats: StatisticsOverview = {
    patients_total: 120,
    new_patients_per_month: [{ month: "2026-05", value: 4 }],
    patients_cumulative_per_month: [{ month: "2026-05", value: 120 }],
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
    income_per_month: [{ month: "2026-05", value: 8450 }],
    revenue_by_payment_method: [{ label: "Cash", value: 3200 }],
    income_current_month: 8450,
    orders_by_status: [],
    orders_per_month: [],
    products_low: 2,
};

const minimalBalanceSheet: BalanceSheet = {
    income: 8450,
    outstanding: 1200,
    cancelled: 50,
    payment_count: 42,
};

describe("buildStatisticsReportBundle", () => {
    it("includes Income section and PDF-friendly basename", () => {
        const bundle = buildStatisticsReportBundle(minimalStats, "6m", "de");
        expect(bundle.docTitle.toLowerCase()).toContain("income");
        expect(bundle.sections.some((s) => s.title.toLowerCase().includes("income"))).toBe(true);
        expect(bundle.suggestedBasename).toMatch(/^medoc-statistics-6m-/);
    });
});

describe("buildBalanceSheetReportBundle", () => {
    it("maps monthly income rows", () => {
        const bundle = buildBalanceSheetReportBundle(minimalBalanceSheet, [["2026-05", { income: 8450, outstanding: 0, cancelled: 0 }]], []);
        expect(bundle.summary[0]?.label).toBe("Income (paid)");
        expect(bundle.sections[0]?.rows[0]?.[1]).toMatch(/8[,.]?450/);
    });
});

describe("buildFinanceReportBundle", () => {
    it("includes transaction table section", () => {
        const bundle = buildFinanceReportBundle(
            [],
            new Map(),
            { incomeMtd: 100, incomeDeltaPct: null, st: 0, openCount: 0, openSum: 0, profitMtd: 100 },
            "All",
        );
        expect(bundle.sections[0]?.title).toBe("Transactions");
        expect(bundle.docTitle).toContain("Finance");
    });
});

describe("buildAuditReportBundleFromCsv", () => {
    it("parses backend CSV header row", () => {
        const csv = "id,created_at,user_id,action,entity,entity_id,details,under_break_glass,break_glass_reason,hmac\n";
        const bundle = buildAuditReportBundleFromCsv(csv, 0);
        expect(bundle.sections[0]?.title).toBe("Audit entries");
        expect(bundle.summary[0]?.value).toBe("0");
    });
});

describe("report serializations", () => {
    const bundle = buildStatisticsReportBundle(minimalStats, "12m", "de");

    it("produces UTF-8 BOM CSV with semicolons", () => {
        const csv = reportBundleToCsv(bundle);
        expect(csv.startsWith("\uFEFF")).toBe(true);
        expect(csv).toContain("Income by month");
        expect(csv).toContain(";");
    });

    it("produces valid JSON", () => {
        const parsed = JSON.parse(reportBundleToJson(bundle)) as { version: number; docTitle: string };
        expect(parsed.version).toBe(1);
        expect(parsed.docTitle).toBeTruthy();
    });

    it("produces XML root element", () => {
        const xml = reportBundleToXml(bundle);
        expect(xml).toContain('<?xml version="1.0"');
        expect(xml).toContain("<medocReport");
    });

    it("builds filenames per format", () => {
        expect(reportFilename(bundle, "pdf")).toMatch(/\.pdf$/);
        expect(reportFilename(bundle, "csv")).toMatch(/\.csv$/);
    });
});
