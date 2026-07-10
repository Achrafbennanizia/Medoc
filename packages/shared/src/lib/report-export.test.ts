import { describe, expect, it } from "vitest";
import {
    buildAuditReportBundleFromCsv,
    buildBilanzReportBundle,
    buildFinanzenReportBundle,
    buildStatistikReportBundle,
    reportBundleToCsv,
    reportBundleToJson,
    reportBundleToXml,
    reportFilename,
} from "./report-export";
import type { Bilanz, StatistikOverview } from "@/models/types";

const minimalStats: StatistikOverview = {
    patienten_gesamt: 120,
    patienten_neu_pro_monat: [{ month: "2026-05", value: 4 }],
    patienten_kumuliert_pro_monat: [{ month: "2026-05", value: 120 }],
    altersgruppen: [],
    geschlechter: [],
    patient_status: [],
    behandlungen_nach_kategorie: [],
    behandlungen_pro_monat: [],
    krankheitsbilder_top: [],
    krankheitsbilder_verlauf_pro_monat: [],
    medikamente_top: [],
    termine_pro_monat: [],
    termin_status: [],
    termin_art: [],
    einnahmen_pro_monat: [{ month: "2026-05", value: 8450 }],
    umsatz_nach_zahlungsart: [{ label: "Bar", value: 3200 }],
    einnahmen_aktueller_monat: 8450,
    bestellungen_nach_status: [],
    bestellungen_pro_monat: [],
    produkte_niedrig: 2,
};

const minimalBilanz: Bilanz = {
    einnahmen: 8450,
    ausstehend: 1200,
    storniert: 50,
    anzahl_zahlungen: 42,
};

describe("buildStatistikReportBundle", () => {
    it("includes Einnahmen section and PDF-friendly basename", () => {
        const bundle = buildStatistikReportBundle(minimalStats, "6m", "de");
        expect(bundle.docTitle).toContain("Einnahmen");
        expect(bundle.sections.some((s) => s.title.includes("Einnahmen pro Monat"))).toBe(true);
        expect(bundle.suggestedBasename).toMatch(/^medoc-statistik-6m-/);
    });
});

describe("buildBilanzReportBundle", () => {
    it("maps monthly income rows", () => {
        const bundle = buildBilanzReportBundle(minimalBilanz, [["2026-05", { einnahmen: 8450, ausstehend: 0, storniert: 0 }]], []);
        expect(bundle.summary[0]?.label).toBe("Einnahmen (bezahlt)");
        expect(bundle.sections[0]?.rows[0]?.[1]).toMatch(/8[,.]?450/);
    });
});

describe("buildFinanzenReportBundle", () => {
    it("includes transaction table section", () => {
        const bundle = buildFinanzenReportBundle(
            [],
            new Map(),
            { einnM: 100, einnDeltaPct: null, st: 0, offeneN: 0, offeneSum: 0, gew: 100 },
            "Alle",
        );
        expect(bundle.sections[0]?.title).toBe("Transaktionen");
        expect(bundle.docTitle).toContain("Finanzen");
    });
});

describe("buildAuditReportBundleFromCsv", () => {
    it("parses backend CSV header row", () => {
        const csv = "id,created_at,user_id,action,entity,entity_id,details,under_break_glass,break_glass_reason,hmac\n";
        const bundle = buildAuditReportBundleFromCsv(csv, 0);
        expect(bundle.sections[0]?.title).toBe("Audit-Einträge");
        expect(bundle.summary[0]?.value).toBe("0");
    });
});

describe("report serializations", () => {
    const bundle = buildStatistikReportBundle(minimalStats, "12m", "de");

    it("produces UTF-8 BOM CSV with semicolons", () => {
        const csv = reportBundleToCsv(bundle);
        expect(csv.startsWith("\uFEFF")).toBe(true);
        expect(csv).toContain("Einnahmen pro Monat");
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
