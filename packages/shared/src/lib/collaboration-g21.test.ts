import { describe, expect, it } from "vitest";
import { buildNativeGoMenuItems, NATIVE_GO_MENU_SEP } from "./native-go-menu";
import { NAV_SECTIONS } from "./nav-sections";
import { INBOX_POLL_MS, INBOX_UI_ENABLED } from "./inbox-config";
import {
    CLINICAL_PATIENT_DETAIL_TABS,
    patientDetailTabBlocked,
    patientDetailTabVisible,
    type PatientDetailChartTab,
} from "./patient-detail-utils";
import { allowed, routeChildPathAllowed } from "./rbac";

describe("G21 collaboration contracts", () => {
    it("Inbox polls every 5 seconds (FA-AUFG-03)", () => {
        expect(INBOX_POLL_MS).toBe(5_000);
    });

    it("RECEPTION: clinical chart tabs hidden, payment/prescription allowed", () => {
        const canViewClinical = allowed("patient.read_medical", "RECEPTION");
        expect(canViewClinical).toBe(false);
        for (const tab of CLINICAL_PATIENT_DETAIL_TABS) {
            expect(patientDetailTabBlocked(tab, canViewClinical)).toBe(true);
            expect(patientDetailTabVisible(tab, canViewClinical)).toBe(false);
        }
        const open: PatientDetailChartTab[] = ["payment", "prescription", "attachment"];
        for (const tab of open) {
            expect(patientDetailTabBlocked(tab, canViewClinical)).toBe(false);
            expect(patientDetailTabVisible(tab, canViewClinical)).toBe(true);
        }
    });

    it("PHYSICIAN: all patient-detail tabs reachable", () => {
        const canViewClinical = allowed("patient.read_medical", "PHYSICIAN");
        expect(canViewClinical).toBe(true);
        for (const tab of CLINICAL_PATIENT_DETAIL_TABS) {
            expect(patientDetailTabBlocked(tab, canViewClinical)).toBe(false);
        }
    });

    it("RECEPTION can open purchase-orders and create orders", () => {
        expect(routeChildPathAllowed("purchase-orders", "RECEPTION")).toBe(true);
        expect(routeChildPathAllowed("purchase-orders/new", "RECEPTION")).toBe(true);
        expect(routeChildPathAllowed("purchase-orders/:id", "RECEPTION")).toBe(true);
        expect(allowed("purchase_order.read", "RECEPTION")).toBe(true);
        expect(allowed("purchase_order.write", "RECEPTION")).toBe(true);
    });

    it("inbox route respects INBOX_UI_ENABLED", () => {
        if (INBOX_UI_ENABLED) {
            expect(routeChildPathAllowed("inbox", "RECEPTION")).toBe(true);
            expect(routeChildPathAllowed("inbox", "PHYSICIAN")).toBe(true);
        } else {
            expect(routeChildPathAllowed("inbox", "RECEPTION")).toBe(false);
            expect(routeChildPathAllowed("inbox", "PHYSICIAN")).toBe(false);
        }
        expect(routeChildPathAllowed("tickets", "RECEPTION")).toBe(true);
        expect(routeChildPathAllowed("administration/tasks", "RECEPTION")).toBe(false);
    });

    it("RECEPTION native Go menu inbox respects INBOX_UI_ENABLED", () => {
        const paths = buildNativeGoMenuItems("RECEPTION", (k) => k)
            .filter((i) => i.path !== NATIVE_GO_MENU_SEP)
            .map((i) => i.path);
        if (INBOX_UI_ENABLED) {
            expect(paths).toContain("/inbox");
            expect(paths.indexOf("/inbox")).toBeLessThan(paths.indexOf("/tickets"));
        } else {
            expect(paths).not.toContain("/inbox");
        }
        expect(paths.indexOf("/tickets")).toBeGreaterThanOrEqual(0);
        expect(paths).toContain("/finance/cash");
        expect(paths).toContain("/purchase-orders");
        expect(paths).not.toContain("/finance");
        expect(paths).not.toContain("/administration/finance-reports/day-close");
        expect(paths).not.toContain("/administration");
    });

    it("GAP-02: RECEPTION has read_documents but not read_medical", () => {
        expect(allowed("patient.read_medical", "RECEPTION")).toBe(false);
        expect(allowed("patient.read_documents", "RECEPTION")).toBe(true);
    });

    it("GAP-01: REZ loads billing B/U via treatments_list_for_payment, not read_medical", () => {
        expect(allowed("patient.treatments_list_for_payment", "RECEPTION")).toBe(true);
        expect(allowed("patient.read_medical", "RECEPTION")).toBe(false);
    });

    it("GAP-01/02: REZ patient-detail IPC contract (load gates)", () => {
        const role = "RECEPTION" as const;
        const wouldLoadClinical = allowed("patient.read_medical", role);
        const wouldLoadPrescriptionsCertificates = allowed("patient.read_documents", role);
        const wouldLoadBillingLines = allowed("patient.treatments_list_for_payment", role);
        expect(wouldLoadClinical).toBe(false);
        expect(wouldLoadPrescriptionsCertificates).toBe(true);
        expect(wouldLoadBillingLines).toBe(true);
    });

    it("Practice sidebar omits day_close (Administration hub only)", () => {
        const practice = NAV_SECTIONS.find((s) => s.labelKey === "nav.section.practice");
        expect(practice?.items).not.toContain("/administration/finance-reports/day-close");
    });

    it("administration/tasks route for PHYSICIAN only (administration)", () => {
        expect(routeChildPathAllowed("administration/tasks", "PHYSICIAN")).toBe(true);
        expect(routeChildPathAllowed("administration/tasks", "RECEPTION")).toBe(false);
    });
});
