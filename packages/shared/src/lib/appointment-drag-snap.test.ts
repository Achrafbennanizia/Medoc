import { describe, expect, it } from "vitest";
import type { Absence } from "../models/types";
import { readPracticeWorkHoursConfig, type PracticeWorkHoursConfig } from "./practice-planning";
import { deriveDayPackingBounds, snapAppointmentDragPosition } from "./appointment-drag-snap";

const TIMELINE = { startMin: 8 * 60, endMin: 19 * 60 };

function cfgSaturdayPractice(): PracticeWorkHoursConfig {
    const base = readPracticeWorkHoursConfig();
    return {
        ...base,
        slotMin: "30",
        breakFrom: "12:00",
        breakUntil: "13:00",
        plan: {
            ...base.plan,
            sa: { active: true, segments: [{ from: "09:00", to: "13:00" }] },
        },
        physicianSchedules: {
            doc1: {
                plan: { ...base.plan, sa: { active: false, segments: [] } },
                breakFrom: base.breakFrom,
                breakUntil: base.breakUntil,
                slotMin: "30",
            },
        },
    };
}

describe("appointment-drag-snap", () => {
    it("snaps Saturday drag to practice hours when doctor profile omits Saturday", () => {
        const cfg = cfgSaturdayPractice();
        const snap = snapAppointmentDragPosition({
            practiceCfg: cfg,
            absences: [],
            physicianId: "doc1",
            isoDate: "2026-07-11",
            rawStartMin: 10 * 60 + 7,
            durMin: 30,
            timelineBounds: TIMELINE,
        });
        expect(snap.dayAllowed).toBe(true);
        expect(snap.slotAllowed).toBe(true);
        expect(snap.startMin).toBe(10 * 60);
    });

    it("snaps away from lunch pause on weekdays", () => {
        const base = readPracticeWorkHoursConfig();
        const cfg: PracticeWorkHoursConfig = {
            ...base,
            breakFrom: "12:00",
            breakUntil: "13:00",
        };
        const snap = snapAppointmentDragPosition({
            practiceCfg: cfg,
            absences: [],
            physicianId: "",
            isoDate: "2026-07-13",
            rawStartMin: 12 * 60 + 15,
            durMin: 30,
            timelineBounds: TIMELINE,
        });
        expect(snap.slotAllowed).toBe(true);
        expect(snap.startMin).not.toBe(12 * 60 + 15);
        expect(snap.startMin === 11 * 60 + 30 || snap.startMin === 13 * 60).toBe(true);
    });

    it("rejects closed days", () => {
        const cfg = readPracticeWorkHoursConfig();
        const snap = snapAppointmentDragPosition({
            practiceCfg: cfg,
            absences: [],
            physicianId: "doc1",
            isoDate: "2026-07-12",
            rawStartMin: 10 * 60,
            durMin: 30,
            timelineBounds: TIMELINE,
        });
        expect(snap.dayAllowed).toBe(false);
        expect(snap.slotAllowed).toBe(false);
    });

    it("deriveDayPackingBounds uses booking merge for doctor", () => {
        const cfg = cfgSaturdayPractice();
        const bounds = deriveDayPackingBounds(cfg, "doc1", "2026-07-11");
        expect(bounds).toEqual({ startMin: 9 * 60, endMin: 13 * 60 });
    });

    it("blocks drag during full-day absence", () => {
        const cfg = readPracticeWorkHoursConfig();
        const abw: Absence[] = [
            {
                id: "a1",
                kind: "URLAUB",
                comment: null,
                from_day: "2026-07-13",
                to_day: "2026-07-13",
                from_time: null,
                to_time: null,
                created_at: "",
                updated_at: "",
            },
        ];
        const snap = snapAppointmentDragPosition({
            practiceCfg: cfg,
            absences: abw,
            physicianId: "",
            isoDate: "2026-07-13",
            rawStartMin: 10 * 60,
            durMin: 30,
            timelineBounds: TIMELINE,
        });
        expect(snap.slotAllowed).toBe(false);
    });
});
