import { describe, expect, it } from "vitest";
import type { Absence, Appointment } from "../models/types";
import {
    readPracticeWorkHoursConfig,
    resolveBookingWorkHoursForPhysician,
    unionWorkSegments,
    type PracticeWorkHoursConfig,
} from "./practice-planning";
import {
    deriveAppointmentTimelineBounds,
    deriveDayClosedSpans,
    deriveDayTimelineBounds,
    listOpenWorkIntervals,
} from "./appointment-calendar-layout";
import { snapAppointmentDragPosition } from "./appointment-drag-snap";
import { buildAppointmentSlotGrid, firstBookableAppointmentSlot } from "./appointment-slot-grid";

/** Thursday 2026-07-16 */
const THU = "2026-07-16";
/** Wednesday 2026-07-15 */
const WED = "2026-07-15";
/** Saturday 2026-07-11 */
const SAT = "2026-07-11";

function baseCfg(partial: Partial<PracticeWorkHoursConfig> = {}): PracticeWorkHoursConfig {
    const base = readPracticeWorkHoursConfig();
    return {
        ...base,
        breakFrom: "12:30",
        breakUntil: "13:30",
        slotMin: "30",
        closures: [],
        ...partial,
        plan: {
            ...base.plan,
            mo: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
            di: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
            mi: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
            do: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
            fr: { active: true, segments: [{ from: "08:00", to: "15:00" }] },
            sa: { active: false, segments: [{ from: "09:00", to: "13:00" }] },
            so: { active: false, segments: [{ from: "09:00", to: "13:00" }] },
            ...(partial.plan ?? {}),
        },
    };
}

function snap(cfg: PracticeWorkHoursConfig, iso: string, rawStartMin: number, physicianId = "doc1") {
    return snapAppointmentDragPosition({
        practiceCfg: cfg,
        absences: [],
        physicianId,
        isoDate: iso,
        rawStartMin,
        durMin: 30,
        timelineBounds: deriveAppointmentTimelineBounds(cfg),
    });
}

function grid(cfg: PracticeWorkHoursConfig, iso: string, physicianId = "doc1") {
    return buildAppointmentSlotGrid({
        practiceCfg: cfg,
        absences: [],
        date: iso,
        physicianId,
        appointments: [],
        durMin: 30,
        bufferMin: 0,
    });
}

describe("unionWorkSegments", () => {
    it("merges overlapping and adjacent windows", () => {
        expect(
            unionWorkSegments(
                [{ from: "08:00", to: "17:00" }],
                [{ from: "16:00", to: "20:00" }, { from: "07:00", to: "08:00" }],
            ),
        ).toEqual([{ from: "07:00", to: "20:00" }]);
    });
});

describe("extended day hours — drag + new-appointment slots", () => {
    it("practice Thursday until 20:00 is on the timeline and bookable", () => {
        const cfg = baseCfg();
        cfg.plan = { ...cfg.plan, do: { active: true, segments: [{ from: "08:00", to: "20:00" }] } };

        expect(deriveDayTimelineBounds(cfg, THU).endMin).toBeGreaterThanOrEqual(20 * 60);
        expect(deriveAppointmentTimelineBounds(cfg).endMin).toBeGreaterThanOrEqual(20 * 60);
        expect(listOpenWorkIntervals(cfg, THU).some((b) => b.endMin >= 20 * 60)).toBe(true);
        expect(snap(cfg, THU, 18 * 60).slotAllowed).toBe(true);
        expect(snap(cfg, THU, 18 * 60).startMin).toBe(18 * 60);
        const g = grid(cfg, THU);
        expect(g.slots).toContain("18:00");
        expect(g.slots).toContain("19:30");
        expect(g.bookableKeys.has(`${THU}|18:00`)).toBe(true);
    });

    it("stale shorter doctor Thursday does not hide practice evening extension", () => {
        const cfg = baseCfg();
        cfg.plan = { ...cfg.plan, do: { active: true, segments: [{ from: "08:00", to: "20:00" }] } };
        cfg.physicianSchedules = {
            doc1: {
                plan: { ...cfg.plan, do: { active: true, segments: [{ from: "08:00", to: "17:00" }] } },
                breakFrom: "12:30",
                breakUntil: "13:30",
                slotMin: "30",
            },
        };
        const eff = resolveBookingWorkHoursForPhysician(cfg, "doc1", THU);
        expect(eff.plan.do.segments.some((s) => s.to >= "20:00")).toBe(true);
        expect(grid(cfg, THU).bookableKeys.has(`${THU}|18:00`)).toBe(true);
        expect(snap(cfg, THU, 18 * 60).slotAllowed).toBe(true);
        // Calendar open look (practice closed-spans) must not contradict booking
        const bounds = deriveDayTimelineBounds(cfg, THU);
        const closed = deriveDayClosedSpans(cfg, THU, bounds);
        const at18 = 18 * 60;
        expect(closed.some((s) => s.fromMin <= at18 && at18 < s.toMin)).toBe(false);
    });

    it("doctor early Wednesday is still bookable via union with practice", () => {
        const cfg = baseCfg();
        cfg.physicianSchedules = {
            doc1: {
                plan: { ...cfg.plan, mi: { active: true, segments: [{ from: "07:00", to: "12:00" }] } },
                breakFrom: "",
                breakUntil: "",
                slotMin: "30",
            },
        };
        const g = grid(cfg, WED);
        expect(g.slots).toContain("07:00");
        expect(g.bookableKeys.has(`${WED}|07:00`)).toBe(true);
        expect(g.bookableKeys.has(`${WED}|16:00`)).toBe(true); // practice afternoon kept
        expect(snap(cfg, WED, 7 * 60).startMin).toBe(7 * 60);
    });

    it("split Thursday segments (morning + late clinic) appear in slot grid and drag", () => {
        const cfg = baseCfg();
        cfg.plan = {
            ...cfg.plan,
            do: {
                active: true,
                segments: [
                    { from: "08:00", to: "12:00" },
                    { from: "16:00", to: "20:00" },
                ],
            },
        };
        cfg.breakFrom = "";
        cfg.breakUntil = "";
        const g = grid(cfg, THU);
        expect(g.slots).toContain("08:00");
        expect(g.slots).not.toContain("13:00");
        expect(g.slots).toContain("16:00");
        expect(g.slots).toContain("19:30");
        expect(snap(cfg, THU, 13 * 60).startMin).not.toBe(13 * 60); // midday gap
        expect(snap(cfg, THU, 17 * 60).startMin).toBe(17 * 60);
    });

    it("practice Saturday stays bookable when doctor profile omits Saturday", () => {
        const cfg = baseCfg();
        cfg.plan = { ...cfg.plan, sa: { active: true, segments: [{ from: "09:00", to: "13:00" }] } };
        cfg.physicianSchedules = {
            doc1: {
                plan: { ...cfg.plan, sa: { active: false, segments: [] } },
                breakFrom: "12:00",
                breakUntil: "13:00",
                slotMin: "30",
            },
        };
        expect(grid(cfg, SAT).bookableKeys.has(`${SAT}|10:00`)).toBe(true);
        expect(snap(cfg, SAT, 10 * 60 + 5).slotAllowed).toBe(true);
    });

    it("full-day closure still blocks extended Thursday evening", () => {
        const cfg = baseCfg();
        cfg.plan = { ...cfg.plan, do: { active: true, segments: [{ from: "08:00", to: "20:00" }] } };
        cfg.closures = [{ id: "c1", date: THU, mode: "FULL_DAY", periods: [] }];
        expect(grid(cfg, THU).bookableKeys.size).toBe(0);
        expect(snap(cfg, THU, 18 * 60).slotAllowed).toBe(false);
    });

    it("holiday absence blocks extended hours the same way as core day", () => {
        const cfg = baseCfg();
        cfg.plan = { ...cfg.plan, do: { active: true, segments: [{ from: "08:00", to: "20:00" }] } };
        const absences: Absence[] = [
            {
                id: "a1",
                kind: "HOLIDAY",
                comment: null,
                from_day: THU,
                to_day: THU,
                from_time: null,
                to_time: null,
                created_at: "",
                updated_at: "",
            },
        ];
        const g = buildAppointmentSlotGrid({
            practiceCfg: cfg,
            absences,
            date: THU,
            physicianId: "doc1",
            appointments: [],
            durMin: 30,
            bufferMin: 0,
        });
        expect(firstBookableAppointmentSlot(g, THU)).toBeUndefined();
    });

    it("existing appointment in evening does not remove other evening slots", () => {
        const cfg = baseCfg();
        cfg.plan = { ...cfg.plan, do: { active: true, segments: [{ from: "08:00", to: "20:00" }] } };
        const busy: Appointment = {
            id: "t1",
            date: THU,
            time: "18:00",
            kind: "CHECKUP",
            status: "PLANNED",
            notes: "Duration: 30 min",
            chief_complaint: null,
            patient_id: "p1",
            physician_id: "doc1",
            created_at: "",
            updated_at: "",
        };
        const g = buildAppointmentSlotGrid({
            practiceCfg: cfg,
            absences: [],
            date: THU,
            physicianId: "doc1",
            appointments: [busy],
            durMin: 30,
            bufferMin: 0,
        });
        expect(g.bookableKeys.has(`${THU}|18:00`)).toBe(false);
        expect(g.bookableKeys.has(`${THU}|18:30`)).toBe(true);
        expect(g.bookableKeys.has(`${THU}|19:00`)).toBe(true);
    });
});
