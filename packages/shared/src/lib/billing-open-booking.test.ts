import { describe, expect, it } from "vitest";
import { treatmentHasBillableServiceItem, isReleasedForBilling, examinationHasBillableServiceItem } from "./billing-open-booking";

describe("FA-LEIST-06/07 billing-open-booking", () => {
    it("detects billable treatment", () => {
        expect(treatmentHasBillableServiceItem("Füllung", null)).toBe(true);
        expect(treatmentHasBillableServiceItem(null, 50)).toBe(true);
        expect(treatmentHasBillableServiceItem("", null)).toBe(false);
        expect(treatmentHasBillableServiceItem("  ", 0)).toBe(false);
    });

    it("detects billable examination (FA-LEIST-07)", () => {
        expect(examinationHasBillableServiceItem("Kontrolle", 30)).toBe(true);
        expect(examinationHasBillableServiceItem(null, null)).toBe(false);
    });

    it("detects physician billing release", () => {
        expect(isReleasedForBilling({ released_by_physician_id: "a1", released_at: "2026-01-01" })).toBe(true);
        expect(isReleasedForBilling({ released_by_physician_id: "a1", released_at: "" })).toBe(false);
        expect(isReleasedForBilling({})).toBe(false);
    });
});
