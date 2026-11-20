import { describe, expect, it } from "vitest";
import {
    absenceBandsOnDay,
    absenceCoversIso,
    formatAlternativeSlots,
    hasPhysicianSlotConflict,
    isAppointmentConflictErrorMessage,
    suggestAlternativeAppointmentSlots,
} from "./appointment-availability";
import { readPracticeWorkHoursConfig } from "./practice-planning";
import type { Absence, Appointment } from "@/models/types";

function appointment(partial: Partial<Appointment>): Appointment {
    return {
        id: "t1",
        date: "2026-05-21",
        time: "10:00",
        kind: "CHECKUP",
        status: "PLANNED",
        notes: null,
        chief_complaint: null,
        patient_id: "p1",
        physician_id: "a1",
        created_at: "2026-05-21T08:00:00Z",
        updated_at: "2026-05-21T08:00:00Z",
        ...partial,
    };
}

describe("appointment-availability (N4)", () => {
    const practiceCfg = readPracticeWorkHoursConfig();

    it("detects conflict messages", () => {
        expect(isAppointmentConflictErrorMessage("Appointment conflict")).toBe(true);
        expect(
            isAppointmentConflictErrorMessage("Physician already has an appointment on 2026-05-21 at 10:00"),
        ).toBe(true);
        expect(isAppointmentConflictErrorMessage("Terminkonflikt")).toBe(false);
        expect(isAppointmentConflictErrorMessage("Physician hat bereits einen Appointment am 2026-05-21 um 10:00")).toBe(false);
        expect(isAppointmentConflictErrorMessage("Netzwerkfehler")).toBe(false);
    });

    it("hasPhysicianSlotConflict matches same slot", () => {
        const rows = [appointment({ time: "10:00:00" })];
        expect(hasPhysicianSlotConflict(rows, "2026-05-21", "10:00", "a1")).toBe(true);
        expect(hasPhysicianSlotConflict(rows, "2026-05-21", "11:00", "a1")).toBe(false);
        expect(hasPhysicianSlotConflict(rows, "2026-05-21", "10:00", "a1", "t1")).toBe(false);
    });

    it("suggests free slots around a busy time", () => {
        const busy = appointment({ time: "10:00:00" });
        const alts = suggestAlternativeAppointmentSlots({
            date: "2026-05-21",
            physicianId: "a1",
            preferredTime: "10:00",
            durMin: 30,
            slotStep: 15,
            appointments: [busy],
            practiceCfg,
            absences: [],
            t: (k) => k,
        });
        expect(alts.length).toBeGreaterThan(0);
        expect(alts).not.toContain("10:00");
        expect(formatAlternativeSlots(alts, (_k, p) => `${p.time} Uhr`)).toMatch(/Uhr/);
    });
});

function absence(partial: Partial<Absence>): Absence {
    return {
        id: "ab-1",
        kind: "Leave",
        comment: null,
        from_day: "2026-05-21",
        to_day: "2026-05-21",
        from_time: null,
        to_time: null,
        created_at: "2026-05-01T00:00:00Z",
        updated_at: "2026-05-01T00:00:00Z",
        ...partial,
    };
}

describe("absence bands", () => {
    it("covers a day inside the saved range and clips a timed absence to the timeline", () => {
        const rows = [
            absence({ from_day: "2026-05-20", to_day: "2026-05-22" }),
            absence({
                id: "ab-2",
                from_day: "2026-05-23",
                to_day: "2026-05-23",
                from_time: "14:00",
                to_time: "16:00",
            }),
        ];
        expect(absenceCoversIso(rows, "2026-05-21")).toBe(true);
        expect(absenceCoversIso(rows, "2026-05-24")).toBe(false);
        expect(absenceBandsOnDay(rows, "2026-05-21", { startMin: 8 * 60, endMin: 18 * 60 })).toEqual([
            { fromMin: 8 * 60, toMin: 18 * 60 },
        ]);
        expect(absenceBandsOnDay(rows, "2026-05-23", { startMin: 8 * 60, endMin: 18 * 60 })).toEqual([
            { fromMin: 14 * 60, toMin: 16 * 60 },
        ]);
    });

    it("merges holidays that overlap on the same day into one span", () => {
        const rows = [
            absence({ from_time: "09:00", to_time: "12:00" }),
            absence({ id: "ab-2", from_time: "11:00", to_time: "15:00" }),
            absence({ id: "ab-3", from_time: "16:00", to_time: "17:00" }),
        ];
        expect(absenceBandsOnDay(rows, "2026-05-21", { startMin: 8 * 60, endMin: 18 * 60 })).toEqual([
            { fromMin: 9 * 60, toMin: 15 * 60 },
            { fromMin: 16 * 60, toMin: 17 * 60 },
        ]);
    });
});
