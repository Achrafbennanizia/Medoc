import { describe, expect, it } from "vitest";
import { behandlungHasBillableLeistung, untersuchungHasBillableLeistung } from "./billing-open-booking";

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
});
