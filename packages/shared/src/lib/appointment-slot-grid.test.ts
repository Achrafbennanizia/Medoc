import { describe, expect, it } from "vitest";
import type { Appointment } from "../models/types";
import { readPracticeWorkHoursConfig, type PracticeWorkHoursConfig } from "./practice-planning";
import { buildAppointmentSlotGrid, hasAppointmentOverlapForPhysician } from "./appointment-slot-grid";

function cfgWithSaturday(): PracticeWorkHoursConfig {
    const base = readPracticeWorkHoursConfig();
    return {
        ...base,
        plan: {
            ...base.plan,
            sa: { active: true, segments: [{ from: "09:00", to: "13:00" }] },
        },
    };
}

function appointment(partial: Partial<Appointment>): Appointment {
    return {
        id: "t1",
        date: "2026-07-10",
        time: "09:00",
        kind: "CHECKUP",
        status: "PLANNED",
        notes: "Duration: 30 min",
        chief_complaint: null,
        patient_id: "p1",
        physician_id: "a1",
        created_at: "2026-07-10T08:00:00Z",
        updated_at: "2026-07-10T08:00:00Z",
        ...partial,
    };
}

describe("appointment-slot-grid", () => {
    it("blocks lunch pause from practice config", () => {
        const cfg = readPracticeWorkHoursConfig();
        const grid = buildAppointmentSlotGrid({
            practiceCfg: cfg,
            absences: [],
            date: "2026-07-10",
            physicianId: "a1",
            appointments: [],
            durMin: 30,
            bufferMin: 0,
        });
        expect(grid.slots).toContain("12:00");
        expect(grid.bookableKeys.has("2026-07-10|12:30")).toBe(false);
        expect(grid.bookableKeys.has("2026-07-10|13:30")).toBe(true);
    });

    it("marks occupied slots for the same Physician", () => {
        const cfg = readPracticeWorkHoursConfig();
        const grid = buildAppointmentSlotGrid({
            practiceCfg: cfg,
            absences: [],
            date: "2026-07-10",
            physicianId: "a1",
            appointments: [appointment({ time: "09:00", notes: "Duration: 30 min" })],
            durMin: 30,
            bufferMin: 0,
        });
        expect(grid.bookableKeys.has("2026-07-10|09:00")).toBe(false);
        expect(grid.bookableKeys.has("2026-07-10|09:30")).toBe(true);
        expect(grid.bookableKeys.has("2026-07-10|10:00")).toBe(true);
    });

    it("respects buffer minutes between appointments", () => {
        const cfg = readPracticeWorkHoursConfig();
        expect(
            hasAppointmentOverlapForPhysician(
                [appointment({ time: "09:00", notes: "Duration: 30 min" })],
                "2026-07-10",
                "a1",
                9 * 60 + 30,
                30,
                15,
            ),
        ).toBe(true);
        expect(
            hasAppointmentOverlapForPhysician(
                [appointment({ time: "09:00", notes: "Duration: 30 min" })],
                "2026-07-10",
                "a1",
                9 * 60 + 45,
                30,
                15,
            ),
        ).toBe(false);
    });

    it("includes Saturday segments when enabled", () => {
        const cfg = cfgWithSaturday();
        const grid = buildAppointmentSlotGrid({
            practiceCfg: cfg,
            absences: [],
            date: "2026-07-11",
            physicianId: "a1",
            appointments: [],
            durMin: 30,
            bufferMin: 0,
        });
        expect(grid.slots).toContain("09:00");
        expect(grid.bookableKeys.has("2026-07-11|09:00")).toBe(true);
    });

    it("uses practice Saturday hours when doctor profile omits Saturday", () => {
        const cfg = cfgWithSaturday();
        const withDoctor: PracticeWorkHoursConfig = {
            ...cfg,
            physicianSchedules: {
                "a1": {
                    plan: {
                        ...cfg.plan,
                        sa: { active: false, segments: [{ from: "09:00", to: "13:00" }] },
                    },
                    breakFrom: cfg.breakFrom,
                    breakUntil: cfg.breakUntil,
                    slotMin: cfg.slotMin,
                },
            },
        };
        const grid = buildAppointmentSlotGrid({
            practiceCfg: withDoctor,
            absences: [],
            date: "2026-07-11",
            physicianId: "a1",
            appointments: [],
            durMin: 30,
            bufferMin: 0,
        });
        expect(grid.slots.length).toBeGreaterThan(0);
        expect(grid.bookableKeys.has("2026-07-11|09:00")).toBe(true);
    });
});
