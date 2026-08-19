import { describe, expect, it } from "vitest";
import type { PracticeDayPlan } from "./practice-planning";
import {
    isValidPauseRange,
    isValidSlotMinutes,
    timeToMinutes,
    validatePracticeWorkPlan,
} from "./practice-work-hours-validation";

function baseDay(seg: { from: string; to: string }): PracticeDayPlan {
    return { active: true, segments: [seg] };
}

describe("timeToMinutes", () => {
    it("parses HH:mm", () => {
        expect(timeToMinutes("08:30")).toBe(510);
        expect(timeToMinutes("00:00")).toBe(0);
    });

    it("returns NaN for garbage", () => {
        expect(Number.isNaN(timeToMinutes(""))).toBe(true);
        expect(Number.isNaN(timeToMinutes("abc"))).toBe(true);
    });
});

describe("validatePracticeWorkPlan", () => {
    const inactive: PracticeDayPlan = { active: false, segments: [{ from: "09:00", to: "13:00" }] };

    it("accepts default-like plan", () => {
        const plan = {
            mo: baseDay({ from: "08:00", to: "17:00" }),
            di: baseDay({ from: "08:00", to: "17:00" }),
            mi: baseDay({ from: "08:00", to: "17:00" }),
            do: baseDay({ from: "08:00", to: "17:00" }),
            fr: baseDay({ from: "08:00", to: "15:00" }),
            sa: inactive,
            so: inactive,
        };
        expect(validatePracticeWorkPlan(plan)).toBeNull();
    });

    it("rejects from >= to", () => {
        const plan = {
            mo: baseDay({ from: "17:00", to: "08:00" }),
            di: inactive,
            mi: inactive,
            do: inactive,
            fr: inactive,
            sa: inactive,
            so: inactive,
        };
        expect(validatePracticeWorkPlan(plan)).toEqual({ code: "segment_order", day: "mo" });
    });

    it("rejects overlapping segments", () => {
        const plan = {
            mo: { active: true, segments: [{ from: "08:00", to: "13:00" }, { from: "12:00", to: "17:00" }] },
            di: inactive,
            mi: inactive,
            do: inactive,
            fr: inactive,
            sa: inactive,
            so: inactive,
        };
        expect(validatePracticeWorkPlan(plan)).toEqual({ code: "overlap", day: "mo" });
    });

    it("allows touching segments (end == next start)", () => {
        const plan = {
            mo: { active: true, segments: [{ from: "08:00", to: "12:00" }, { from: "12:00", to: "17:00" }] },
            di: inactive,
            mi: inactive,
            do: inactive,
            fr: inactive,
            sa: inactive,
            so: inactive,
        };
        expect(validatePracticeWorkPlan(plan)).toBeNull();
    });

    it("requires at least one segment on active days", () => {
        const plan = {
            mo: { active: true, segments: [] },
            di: inactive,
            mi: inactive,
            do: inactive,
            fr: inactive,
            sa: inactive,
            so: inactive,
        };
        expect(validatePracticeWorkPlan(plan)).toEqual({ code: "segment_required", day: "mo" });
    });

    it("skips validation for inactive days with empty segments", () => {
        const plan = {
            mo: baseDay({ from: "08:00", to: "17:00" }),
            di: baseDay({ from: "08:00", to: "17:00" }),
            mi: baseDay({ from: "08:00", to: "17:00" }),
            do: baseDay({ from: "08:00", to: "17:00" }),
            fr: baseDay({ from: "08:00", to: "15:00" }),
            sa: { active: false, segments: [] },
            so: inactive,
        };
        expect(validatePracticeWorkPlan(plan)).toBeNull();
    });
});

describe("isValidPauseRange", () => {
    it("accepts start before end", () => {
        expect(isValidPauseRange("12:30", "13:30")).toBe(true);
    });

    it("rejects equal or inverted range when both parse", () => {
        expect(isValidPauseRange("13:00", "13:00")).toBe(false);
        expect(isValidPauseRange("14:00", "12:00")).toBe(false);
    });
});

describe("isValidSlotMinutes", () => {
    it("enforces minimum", () => {
        expect(isValidSlotMinutes("30")).toBe(true);
        expect(isValidSlotMinutes("9")).toBe(false);
        expect(isValidSlotMinutes("xx")).toBe(false);
    });
});
