import { describe, expect, it } from "vitest";
import { addDays, startOfWeek } from "date-fns";
import { readPraxisArbeitszeitenConfig, hasAnyAvailableSlot, isCalendarDaySelectable, isPraxisDayBookable, type PraxisArbeitszeitenConfig } from "./praxis-planning";
import {
    activePraxisDayKeys,
    buildTerminMonthCalendarCells,
    deriveTerminTimelineBounds,
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

    it("derives timeline bounds from active segments", () => {
        const cfg = cfgWithSaturday();
        const bounds = deriveTerminTimelineBounds(cfg);
        expect(bounds.startMin).toBe(8 * 60);
        expect(bounds.endMin).toBeGreaterThanOrEqual(17 * 60);
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
