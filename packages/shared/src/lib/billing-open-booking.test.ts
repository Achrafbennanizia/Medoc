import { describe, expect, it } from "vitest";
import { behandlungHasBillableLeistung, isReleasedForBilling, untersuchungHasBillableLeistung } from "./billing-open-booking";

describe("FA-LEIST-06/07 billing-open-booking", () => {
    it("detects billable behandlung", () => {
        expect(behandlungHasBillableLeistung("Füllung", null)).toBe(true);
        expect(behandlungHasBillableLeistung(null, 50)).toBe(true);
        expect(behandlungHasBillableLeistung("", null)).toBe(false);
        expect(behandlungHasBillableLeistung("  ", 0)).toBe(false);
    });

    it("detects billable untersuchung (FA-LEIST-07)", () => {
        expect(untersuchungHasBillableLeistung("Kontrolle", 30)).toBe(true);
        expect(untersuchungHasBillableLeistung(null, null)).toBe(false);
    });

    it("detects physician billing release", () => {
        expect(isReleasedForBilling({ freigegeben_von_arzt_id: "a1", freigegeben_am: "2026-01-01" })).toBe(true);
        expect(isReleasedForBilling({ freigegeben_von_arzt_id: "a1", freigegeben_am: "" })).toBe(false);
        expect(isReleasedForBilling({})).toBe(false);
    });
});
