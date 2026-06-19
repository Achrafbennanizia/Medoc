import { describe, expect, it } from "vitest";
import { buildNativeGoMenuItems, NATIVE_GO_MENU_SEP } from "./native-go-menu";
import { NAV_SECTIONS } from "./nav-sections";
import { POSTEINGANG_POLL_MS, POSTEINGANG_UI_ENABLED } from "./posteingang-config";
import {
    CLINICAL_PATIENT_DETAIL_TABS,
    patientDetailTabBlocked,
    patientDetailTabVisible,
    type PatientDetailAkteTab,
} from "./patient-detail-utils";
import { allowed, routeChildPathAllowed } from "./rbac";

describe("G21 collaboration contracts", () => {
    it("Posteingang polls every 5 seconds (FA-AUFG-03)", () => {
        expect(POSTEINGANG_POLL_MS).toBe(5_000);
    });

    it("REZEPTION: clinical akte tabs hidden, zahl/rezept allowed", () => {
        const canViewClinical = allowed("patient.read_medical", "REZEPTION");
        expect(canViewClinical).toBe(false);
        for (const tab of CLINICAL_PATIENT_DETAIL_TABS) {
            expect(patientDetailTabBlocked(tab, canViewClinical)).toBe(true);
            expect(patientDetailTabVisible(tab, canViewClinical)).toBe(false);
        }
        const open: PatientDetailAkteTab[] = ["zahl", "rezept", "anlage"];
        for (const tab of open) {
            expect(patientDetailTabBlocked(tab, canViewClinical)).toBe(false);
            expect(patientDetailTabVisible(tab, canViewClinical)).toBe(true);
        }
    });

    it("ARZT: all patient-detail tabs reachable", () => {
        const canViewClinical = allowed("patient.read_medical", "ARZT");
        expect(canViewClinical).toBe(true);
        for (const tab of CLINICAL_PATIENT_DETAIL_TABS) {
            expect(patientDetailTabBlocked(tab, canViewClinical)).toBe(false);
        }
    });

    it("REZEPTION can open bestellungen and create orders", () => {
        expect(routeChildPathAllowed("bestellungen", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("bestellungen/neu", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("bestellungen/:id", "REZEPTION")).toBe(true);
        expect(allowed("bestellung.read", "REZEPTION")).toBe(true);
        expect(allowed("bestellung.write", "REZEPTION")).toBe(true);
    });

    it("posteingang route respects POSTEINGANG_UI_ENABLED", () => {
        if (POSTEINGANG_UI_ENABLED) {
            expect(routeChildPathAllowed("posteingang", "REZEPTION")).toBe(true);
            expect(routeChildPathAllowed("posteingang", "ARZT")).toBe(true);
        } else {
            expect(routeChildPathAllowed("posteingang", "REZEPTION")).toBe(false);
            expect(routeChildPathAllowed("posteingang", "ARZT")).toBe(false);
        }
        expect(routeChildPathAllowed("tickets", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/aufgaben", "REZEPTION")).toBe(false);
    });

    it("REZEPTION native Go menu posteingang respects POSTEINGANG_UI_ENABLED", () => {
        const paths = buildNativeGoMenuItems("REZEPTION", (k) => k)
            .filter((i) => i.path !== NATIVE_GO_MENU_SEP)
            .map((i) => i.path);
        if (POSTEINGANG_UI_ENABLED) {
            expect(paths).toContain("/posteingang");
            expect(paths.indexOf("/posteingang")).toBeLessThan(paths.indexOf("/tickets"));
        } else {
            expect(paths).not.toContain("/posteingang");
        }
        expect(paths.indexOf("/tickets")).toBeGreaterThanOrEqual(0);
        expect(paths).toContain("/finanzen/kasse");
        expect(paths).toContain("/bestellungen");
        expect(paths).not.toContain("/finanzen");
        expect(paths).not.toContain("/verwaltung/finanzen-berichte/tagesabschluss");
        expect(paths).not.toContain("/verwaltung");
    });

    it("GAP-02: REZEPTION has read_documents but not read_medical", () => {
        expect(allowed("patient.read_medical", "REZEPTION")).toBe(false);
        expect(allowed("patient.read_documents", "REZEPTION")).toBe(true);
    });

    it("GAP-01: REZ loads billing B/U via behandlungen_list_for_zahlung, not read_medical", () => {
        expect(allowed("patient.behandlungen_list_for_zahlung", "REZEPTION")).toBe(true);
        expect(allowed("patient.read_medical", "REZEPTION")).toBe(false);
    });

    it("GAP-01/02: REZ patient-detail IPC contract (load gates)", () => {
        const role = "REZEPTION" as const;
        const wouldLoadClinical = allowed("patient.read_medical", role);
        const wouldLoadRezepteAtteste = allowed("patient.read_documents", role);
        const wouldLoadBillingLines = allowed("patient.behandlungen_list_for_zahlung", role);
        expect(wouldLoadClinical).toBe(false);
        expect(wouldLoadRezepteAtteste).toBe(true);
        expect(wouldLoadBillingLines).toBe(true);
    });

    it("Praxis sidebar omits tagesabschluss (Verwaltung hub only)", () => {
        const praxis = NAV_SECTIONS.find((s) => s.labelKey === "nav.section.practice");
        expect(praxis?.items).not.toContain("/verwaltung/finanzen-berichte/tagesabschluss");
    });

    it("verwaltung/aufgaben route für ARZT only (Verwaltung)", () => {
        expect(routeChildPathAllowed("verwaltung/aufgaben", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/aufgaben", "REZEPTION")).toBe(false);
    });
});
