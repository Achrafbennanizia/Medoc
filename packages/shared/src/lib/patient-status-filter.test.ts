import { describe, expect, it } from "vitest";
import {
    patientMatchesStatusFilter,
} from "./patient-status-filter";

describe("patientMatchesStatusFilter", () => {
    const open = new Set(["p-inv"]);

    it("matches each tab rule", () => {
        expect(patientMatchesStatusFilter({ id: "a", status: "ACTIVE" }, "IN_TREATMENT", open)).toBe(true);
        // Lifecycle and invoice flag are independent: an active patient with an open invoice is in both.
        expect(patientMatchesStatusFilter({ id: "p-inv", status: "ACTIVE" }, "IN_TREATMENT", open)).toBe(true);
        expect(patientMatchesStatusFilter({ id: "p-inv", status: "ACTIVE" }, "INVOICE_OPEN", open)).toBe(true);
        // "Record open" follows the record's own status, not the patient status.
        expect(patientMatchesStatusFilter({ id: "n", status: "NEW" }, "CHART_OPEN", open, new Set(["n"]))).toBe(true);
        expect(patientMatchesStatusFilter({ id: "n", status: "NEW" }, "CHART_OPEN", open)).toBe(false);
        expect(patientMatchesStatusFilter({ id: "v", status: "VALIDATED" }, "IN_TREATMENT", open)).toBe(false);
        expect(patientMatchesStatusFilter({ id: "c", status: "READONLY" }, "CLOSED", open)).toBe(true);
        expect(patientMatchesStatusFilter({ id: "c", status: "VALIDATED" }, "CLOSED", open)).toBe(true);
    });
});
