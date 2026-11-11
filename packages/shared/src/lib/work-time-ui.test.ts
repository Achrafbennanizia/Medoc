import { describe, expect, it } from "vitest";
import { weekBarScaleMinutes } from "./work-time-ui";

describe("weekBarScaleMinutes", () => {
    it("keeps a short day short when no target is set", () => {
        expect(weekBarScaleMinutes({ targetMinutes: 0, workedMinutes: 30, openMinutes: 0 })).toBe(8 * 60);
    });

    it("grows past a standard day when the worked time is longer", () => {
        expect(weekBarScaleMinutes({ targetMinutes: 0, workedMinutes: 600, openMinutes: 0 })).toBe(600);
    });

    it("uses the target when one is set", () => {
        expect(weekBarScaleMinutes({ targetMinutes: 420, workedMinutes: 60, openMinutes: 0 })).toBe(420);
    });
});
