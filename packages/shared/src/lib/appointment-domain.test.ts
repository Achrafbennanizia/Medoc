import { describe, expect, it } from "vitest";
import {
    APPOINTMENT_EMERGENCY_NOTE_MARKER,
    appointmentIsEmergencyMarked,
    parseAppointmentDurationMin,
} from "./appointment-domain";
import type { Appointment } from "@/models/types";

describe("appointmentIsEmergencyMarked", () => {
    it("is true for TREATMENT with calendar marker in notes", () => {
        const t = {
            kind: "TREATMENT",
            notes: `Foo · ${APPOINTMENT_EMERGENCY_NOTE_MARKER}`,
        } as Appointment;
        expect(appointmentIsEmergencyMarked(t)).toBe(true);
    });

    it("is false without marker or wrong kind", () => {
        expect(appointmentIsEmergencyMarked({ kind: "TREATMENT", notes: null } as Appointment)).toBe(false);
        expect(appointmentIsEmergencyMarked({ kind: "CHECKUP", notes: APPOINTMENT_EMERGENCY_NOTE_MARKER } as Appointment)).toBe(false);
    });
});

describe("parseAppointmentDurationMin", () => {
    it("reads English Duration wire", () => {
        expect(parseAppointmentDurationMin("Duration: 45 min")).toBe(45);
    });

    it("reads leftover Dauer wire", () => {
        expect(parseAppointmentDurationMin("Dauer: 30 min")).toBe(30);
    });
});

describe("appointmentIsEmergencyMarked", () => {
    it("is true for TREATMENT with calendar marker in notes", () => {
        const t = {
            kind: "TREATMENT",
            notes: `Foo · ${APPOINTMENT_EMERGENCY_NOTE_MARKER}`,
        } as Appointment;
        expect(appointmentIsEmergencyMarked(t)).toBe(true);
    });

    it("is false without marker or wrong kind", () => {
        expect(appointmentIsEmergencyMarked({ kind: "TREATMENT", notes: null } as Appointment)).toBe(false);
        expect(appointmentIsEmergencyMarked({ kind: "CHECKUP", notes: APPOINTMENT_EMERGENCY_NOTE_MARKER } as Appointment)).toBe(false);
    });
});
