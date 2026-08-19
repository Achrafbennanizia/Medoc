import { describe, expect, it } from "vitest";
import {
    formatAlternativeSlots,
    hasPhysicianSlotConflict,
    isAppointmentConflictErrorMessage,
    suggestAlternativeAppointmentSlots,
} from "./appointment-availability";
import { readPracticeWorkHoursConfig } from "./practice-planning";
import type { Appointment } from "@/models/types";

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
        // Legacy German IPC phrases still recognized.
        expect(isAppointmentConflictErrorMessage("Terminkonflikt")).toBe(true);
        expect(isAppointmentConflictErrorMessage("Physician hat bereits einen Appointment am 2026-05-21 um 10:00")).toBe(true);
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
