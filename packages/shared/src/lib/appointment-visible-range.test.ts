import { describe, expect, it } from "vitest";
import {
    eachIsoDate,
    mergeAppointmentsInSpan,
    replaceAppointmentsInSpan,
    monthGridRangeForView,
    practiceYearRange,
    rangeIsCovered,
} from "./appointment-visible-range";

describe("appointment visible range", () => {
    const today = new Date(2026, 10, 8);

    it("loads one month grid, not the practice year", () => {
        const month = monthGridRangeForView("month", 0, 0, 0, today);
        const year = practiceYearRange(today);
        const monthDays = eachIsoDate(month.from, month.to).length;
        const yearDays = eachIsoDate(year.from, year.to).length;
        expect(monthDays).toBe(42);
        expect(yearDays).toBeGreaterThan(400);
        expect(yearDays).toBeLessThan(450);
        expect(month.from > year.from).toBe(true);
    });

    it("keeps day navigation inside the same fetched month", () => {
        const first = monthGridRangeForView("day", 0, 0, 0, today);
        const next = monthGridRangeForView("day", 0, 0, 1, today);
        expect(next).toEqual(first);
        const covered = new Set(eachIsoDate(first.from, first.to));
        expect(rangeIsCovered(covered, next.from, next.to)).toBe(true);
    });

    it("keeps a newer local row when a stale range response arrives", () => {
        const local = { id: "a", date: "2026-11-08", updated_at: "2026-11-08T12:00:00.000Z", time: "10:00" };
        const stale = { id: "a", date: "2026-11-08", updated_at: "2026-11-08T09:00:00.000Z", time: "09:00" };
        const outside = { id: "b", date: "2027-01-15", updated_at: "2026-11-01T00:00:00.000Z", time: "08:00" };
        const merged = mergeAppointmentsInSpan([local, outside], [stale], "2026-10-26", "2026-12-06");
        expect(merged.find((row) => row.id === "a")?.time).toBe("10:00");
        expect(merged.find((row) => row.id === "b")?.date).toBe("2027-01-15");
    });

    it("a database refresh replaces the row on screen", () => {
        const shown = { id: "a", date: "2026-11-08", time: "09:00" };
        const fromDb = { id: "a", date: "2026-11-08", time: "11:30" };
        const outside = { id: "b", date: "2027-01-15", time: "08:00" };
        const next = replaceAppointmentsInSpan([shown, outside], [fromDb], "2026-10-26", "2026-12-06");
        expect(next.find((row) => row.id === "a")?.time).toBe("11:30");
        expect(next.find((row) => row.id === "b")?.date).toBe("2027-01-15");
    });
});
