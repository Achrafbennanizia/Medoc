import { describe, expect, it } from "vitest";
import { buildNativeGoMenuItems, NATIVE_GO_MENU_SEP } from "./native-go-menu";
import { POSTEINGANG_POLL_MS } from "./posteingang-config";
import {
    CLINICAL_PATIENT_DETAIL_TABS,
    patientDetailTabBlocked,
    type PatientDetailAkteTab,
} from "./patient-detail-utils";
import { allowed, routeChildPathAllowed } from "./rbac";

describe("G21 collaboration contracts", () => {
    it("Posteingang polls every 5 seconds (FA-AUFG-03)", () => {
        expect(POSTEINGANG_POLL_MS).toBe(5_000);
    });

    it("REZEPTION: clinical akte tabs blocked, zahl/stamm allowed", () => {
        const canViewClinical = allowed("patient.read_medical", "REZEPTION");
        expect(canViewClinical).toBe(false);
        for (const tab of CLINICAL_PATIENT_DETAIL_TABS) {
            expect(patientDetailTabBlocked(tab, canViewClinical)).toBe(true);
        }
        const open: PatientDetailAkteTab[] = ["stamm", "zahl", "rezept", "anlage"];
        for (const tab of open) {
            expect(patientDetailTabBlocked(tab, canViewClinical)).toBe(false);
        }
    });

    it("ARZT: all patient-detail tabs reachable", () => {
        const canViewClinical = allowed("patient.read_medical", "ARZT");
        expect(canViewClinical).toBe(true);
        for (const tab of CLINICAL_PATIENT_DETAIL_TABS) {
            expect(patientDetailTabBlocked(tab, canViewClinical)).toBe(false);
        }
    });

    it("REZEPTION can open tickets and posteingang", () => {
        expect(routeChildPathAllowed("posteingang", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("tickets", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/aufgaben", "REZEPTION")).toBe(true);
    });

    it("REZEPTION native Go menu includes posteingang, tickets, and tagesabschluss", () => {
        const paths = buildNativeGoMenuItems("REZEPTION", (k) => k)
            .filter((i) => i.path !== NATIVE_GO_MENU_SEP)
            .map((i) => i.path);
        expect(paths).toContain("/posteingang");
        expect(paths.indexOf("/tickets")).toBeGreaterThanOrEqual(0);
        expect(paths.indexOf("/posteingang")).toBeLessThan(paths.indexOf("/tickets"));
        expect(paths).toContain("/verwaltung/finanzen-berichte/tagesabschluss");
    });

    it("GAP-02: REZEPTION has read_documents but not read_medical", () => {
        expect(allowed("patient.read_medical", "REZEPTION")).toBe(false);
        expect(allowed("patient.read_documents", "REZEPTION")).toBe(true);
    });

    it("verwaltung/aufgaben route für ARZT und REZEPTION (Verwaltung)", () => {
        expect(routeChildPathAllowed("verwaltung/aufgaben", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/aufgaben", "REZEPTION")).toBe(true);
    });
});
