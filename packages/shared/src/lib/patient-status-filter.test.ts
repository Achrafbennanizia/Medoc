import { describe, expect, it } from "vitest";
import {
    patientMatchesStatusFilter,
    patientStatusFilterNeedsClientBucket,
    patientStatusFilterServerStatus,
} from "./patient-status-filter";

describe("patientStatusFilterNeedsClientBucket", () => {
    it("flags invoice/treatment/closed tabs that need a full scan", () => {
        expect(patientStatusFilterNeedsClientBucket("ALL")).toBe(false);
        expect(patientStatusFilterNeedsClientBucket("NEW_PATIENT")).toBe(false);
        expect(patientStatusFilterNeedsClientBucket("IN_TREATMENT")).toBe(true);
        expect(patientStatusFilterNeedsClientBucket("INVOICE_OPEN")).toBe(true);
        expect(patientStatusFilterNeedsClientBucket("CHART_OPEN")).toBe(true);
        expect(patientStatusFilterNeedsClientBucket("CLOSED")).toBe(true);
    });
});

describe("patientStatusFilterServerStatus", () => {
    it("only maps NEW_PATIENT to a server status", () => {
        expect(patientStatusFilterServerStatus("NEW_PATIENT")).toBe("NEW");
        expect(patientStatusFilterServerStatus("CLOSED")).toBeUndefined();
        expect(patientStatusFilterServerStatus("ALL")).toBeUndefined();
    });
});

describe("patientMatchesStatusFilter", () => {
    const open = new Set(["p-inv"]);

    it("matches each tab rule", () => {
        expect(patientMatchesStatusFilter({ id: "a", status: "ACTIVE" }, "IN_TREATMENT", open)).toBe(true);
        expect(patientMatchesStatusFilter({ id: "p-inv", status: "ACTIVE" }, "IN_TREATMENT", open)).toBe(false);
        expect(patientMatchesStatusFilter({ id: "p-inv", status: "ACTIVE" }, "INVOICE_OPEN", open)).toBe(true);
        expect(patientMatchesStatusFilter({ id: "n", status: "NEW" }, "CHART_OPEN", open)).toBe(true);
        expect(patientMatchesStatusFilter({ id: "p-inv", status: "NEW" }, "CHART_OPEN", open)).toBe(false);
        expect(patientMatchesStatusFilter({ id: "c", status: "READONLY" }, "CLOSED", open)).toBe(true);
        expect(patientMatchesStatusFilter({ id: "c", status: "VALIDATED" }, "CLOSED", open)).toBe(true);
    });
});
