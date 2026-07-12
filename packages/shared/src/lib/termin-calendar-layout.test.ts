import { describe, expect, it } from "vitest";
import { addDays, startOfWeek } from "date-fns";
import { readPraxisArbeitszeitenConfig, hasAnyAvailableSlot, isCalendarDaySelectable, isPraxisDayBookable, type PraxisArbeitszeitenConfig } from "./praxis-planning";
import { uhrzeitToMinutes } from "./termin-availability";
import {
    activePraxisDayKeys,
    buildTerminMonthCalendarCells,
    deriveDayClosedSpans,
    deriveDayTimelineBounds,
    deriveTerminTimelineBounds,
    deriveWeekTimelineBounds,
    terminCalendarColumnCount,
    terminCalendarColumnDayKeys,
    terminCalendarIsoWeekdayOffsets,
    terminCalendarWeekDays,
} from "./termin-calendar-layout";

function cfgWithSaturday(): PraxisArbeitszeitenConfig {
    const base = readPraxisArbeitszeitenConfig();
    return {
        ...base,
        plan: {
            ...base.plan,
            sa: { aktiv: true, segments: [{ from: "09:00", to: "13:00" }] },
        },
    };
}

describe("termin-calendar-layout", () => {
    it("defaults to Mon–Fri columns", () => {
        const cfg = readPraxisArbeitszeitenConfig();
        expect(terminCalendarColumnDayKeys(cfg)).toEqual(["mo", "di", "mi", "do", "fr"]);
        expect(terminCalendarColumnCount(cfg)).toBe(5);
        expect(terminCalendarIsoWeekdayOffsets(cfg)).toEqual([0, 1, 2, 3, 4]);
    });

    it("extends to Saturday when enabled in admin plan", () => {
        const cfg = cfgWithSaturday();
        expect(activePraxisDayKeys(cfg)).toContain("sa");
        expect(terminCalendarColumnDayKeys(cfg)).toEqual(["mo", "di", "mi", "do", "fr", "sa"]);
        expect(terminCalendarColumnCount(cfg)).toBe(6);
    });

    it("builds month cells only for visible working columns", () => {
        const cfg = cfgWithSaturday();
        const anchor = startOfWeek(new Date(2026, 6, 1), { weekStartsOn: 1 });
        const cells = buildTerminMonthCalendarCells(anchor, cfg);
        expect(cells.length).toBe(6 * 6);
        const firstWeek = cells.slice(0, 6);
        expect(firstWeek.map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("week view days follow practice plan", () => {
        const cfg = cfgWithSaturday();
        const anchor = startOfWeek(new Date(2026, 6, 6), { weekStartsOn: 1 });
        const days = terminCalendarWeekDays(anchor, cfg);
        expect(days).toHaveLength(6);
        expect(days[5]!.getDay()).toBe(6);
        expect(formatIso(days[5]!)).toBe(formatIso(addDays(anchor, 5)));
    });

    it("deriveWeekTimelineBounds uses tallest day in the week", () => {
        const base = readPraxisArbeitszeitenConfig();
        const cfg: PraxisArbeitszeitenConfig = {
            ...base,
            plan: {
                ...base.plan,
                fr: { aktiv: true, segments: [{ from: "08:00", to: "15:00" }] },
                sa: { aktiv: true, segments: [{ from: "09:00", to: "13:00" }] },
            },
        };
        const fri = deriveDayTimelineBounds(cfg, "2026-07-10");
        const mon = deriveDayTimelineBounds(cfg, "2026-07-13");
        const week = deriveWeekTimelineBounds(cfg, ["2026-07-10", "2026-07-13"]);
        expect(week.startMin).toBe(Math.min(fri.startMin, mon.startMin));
        expect(week.endMin).toBe(Math.max(fri.endMin, mon.endMin));
    });

    it("deriveDayClosedSpans marks lunch pause within working hours", () => {
        const base = readPraxisArbeitszeitenConfig();
        const bounds = deriveDayTimelineBounds(base, "2026-07-13");
        const closed = deriveDayClosedSpans(base, "2026-07-13", bounds);
        const pauseStart = uhrzeitToMinutes(base.pauseVon);
        const pauseEnd = uhrzeitToMinutes(base.pauseBis);
        expect(
            closed.some((s) => s.fromMin <= pauseStart && s.toMin >= pauseEnd),
        ).toBe(true);
    });

    it("deriveDayClosedSpans marks after-hours when segment ends before timeline", () => {
        const base = readPraxisArbeitszeitenConfig();
        const bounds = { startMin: 8 * 60, endMin: 18 * 60 };
        const closed = deriveDayClosedSpans(base, "2026-07-10", bounds);
        expect(closed.some((s) => s.fromMin >= 15 * 60 && s.toMin <= 18 * 60)).toBe(true);
    });

    it("deriveDayClosedSpans fills inactive days", () => {
        const cfg = cfgWithSaturday();
        const bounds = deriveWeekTimelineBounds(cfg, ["2026-07-12"]);
        const closed = deriveDayClosedSpans(cfg, "2026-07-12", bounds);
        expect(closed).toEqual([{ fromMin: bounds.startMin, toMin: bounds.endMin }]);
    });

    it("isCalendarDaySelectable uses practice plan even when doctor profile differs", () => {
        const base = readPraxisArbeitszeitenConfig();
        const practiceSat: PraxisArbeitszeitenConfig = {
            ...base,
            plan: {
                ...base.plan,
                sa: { aktiv: true, segments: [{ from: "09:00", to: "13:00" }] },
            },
            arztSchedules: {
                "dr-a": {
                    plan: {
                        ...base.plan,
                        sa: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
                    },
                    pauseVon: base.pauseVon,
                    pauseBis: base.pauseBis,
                    slotMin: base.slotMin,
                },
            },
        };
        expect(isCalendarDaySelectable(practiceSat, "2026-07-11", "dr-a")).toBe(true);
    });

    it("hasAnyAvailableSlot returns true for enabled Saturday", () => {
        const cfg = cfgWithSaturday();
        expect(hasAnyAvailableSlot(cfg, "2026-07-11")).toBe(true);
        expect(isPraxisDayBookable(cfg, "2026-07-11")).toBe(true);
        expect(hasAnyAvailableSlot(cfg, "2026-07-12")).toBe(false);
    });
});

function formatIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
