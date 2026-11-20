import { afterEach, describe, expect, it } from "vitest";
import { clockNowMs, instantLocalYmd, localYmd, parseInstant, recordHostClockSample, resetPracticeClock, wallClockToDate } from "./practice-clock";

afterEach(() => resetPracticeClock());

describe("practice clock", () => {
    it("treats naive backend timestamps as UTC", () => {
        expect(parseInstant("2026-11-20 09:15:00")?.toISOString()).toBe("2026-11-20T09:15:00.000Z");
        expect(parseInstant("2026-11-20T09:15:00")?.toISOString()).toBe("2026-11-20T09:15:00.000Z");
        expect(parseInstant("2026-11-20T09:15:00+02:00")?.toISOString()).toBe("2026-11-20T07:15:00.000Z");
    });

    it("treats date-only as a local calendar date", () => {
        const d = parseInstant("2026-11-20")!;
        expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 20, 0]);
        expect(localYmd(d)).toBe("2026-11-20");
    });

    it("uses local (not UTC) calendar dates", () => {
        const lateEvening = new Date(2026, 10, 20, 23, 59);
        expect(localYmd(lateEvening)).toBe("2026-11-20");
        expect(instantLocalYmd("")).toBe("");
        expect(wallClockToDate("2026-11-20", "08:30")?.getHours()).toBe(8);
    });

    it("applies the host offset and ignores noise / absurd samples", () => {
        const now = Date.now();
        recordHostClockSample(new Date(now + 120_000).toISOString(), now, now);
        expect(Math.round((clockNowMs() - Date.now()) / 1000)).toBe(120);
        resetPracticeClock();
        recordHostClockSample(new Date(now + 500).toISOString(), now, now);
        expect(Math.abs(clockNowMs() - Date.now())).toBeLessThan(50);
        recordHostClockSample(new Date(now + 3 * 86_400_000).toISOString(), now, now);
        expect(Math.abs(clockNowMs() - Date.now())).toBeLessThan(50);
    });
});
