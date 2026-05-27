import { describe, expect, it } from "vitest";
import { buildStatistikReportBundle, reportBundleToJson, reportBundleToXml } from "./report-export";
import { parseReportBundleJson, parseReportBundleXml } from "./report-import";
import type { StatistikOverview } from "@/models/types";

const minimalStats: StatistikOverview = {
    patienten_gesamt: 10,
    patienten_neu_pro_monat: [],
    patienten_kumuliert_pro_monat: [],
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
    einnahmen_pro_monat: [{ month: "2026-05", value: 1000 }],
    umsatz_nach_zahlungsart: [],
    einnahmen_aktueller_monat: 1000,
    bestellungen_nach_status: [],
    bestellungen_pro_monat: [],
    produkte_niedrig: 0,
};

describe("report import round-trip", () => {
    it("JSON export → parse preserves docTitle and sections", () => {
        const bundle = buildStatistikReportBundle(minimalStats, "6m");
        const parsed = parseReportBundleJson(reportBundleToJson(bundle));
        expect(parsed.docTitle).toBe(bundle.docTitle);
        expect(parsed.sections.length).toBe(bundle.sections.length);
        expect(parsed.summary.length).toBeGreaterThan(0);
    });

    it("XML export → parse preserves title", () => {
        const bundle = buildStatistikReportBundle(minimalStats, "12m");
        const parsed = parseReportBundleXml(reportBundleToXml(bundle));
        expect(parsed.docTitle).toBe(bundle.docTitle);
        expect(parsed.sections[0]?.title).toBe(bundle.sections[0]?.title);
    });
});
