import { describe, expect, it } from "vitest";
import { APPOINTMENT_EMERGENCY_NOTE_MARKER } from "@/lib/appointment-domain";
import {
    appointmentStateDisplay,
    appointmentKindLabel,
    appointmentKindLabelFromAppointment,
    appointmentCountsAsPlanned,
} from "@/lib/appointment-calendar-ui";
import type { Appointment } from "@/models/types";

function appointment(partial: Partial<Appointment>): Appointment {
    return {
        id: "t1",
        date: "2026-05-20",
        time: "10:00",
        kind: "CHECKUP",
        status: "PLANNED",
        notes: null,
        chief_complaint: null,
        patient_id: "p1",
        physician_id: "a1",
        created_at: "2026-05-20T08:00:00Z",
        updated_at: "2026-05-20T08:00:00Z",
        ...partial,
    };
}

describe("appointment-calendar-ui", () => {
    it("appointmentKindLabel maps known kind", () => {
        expect(appointmentKindLabel("CHECKUP")).toBe("Check-up");
    });

    it("appointmentKindLabelFromAppointment detects emergency marker", () => {
        expect(
            appointmentKindLabelFromAppointment(
                appointment({ kind: "TREATMENT", notes: APPOINTMENT_EMERGENCY_NOTE_MARKER }),
            ),
        ).toBe("Emergency");
    });

    it("appointmentStateDisplay cancelled", () => {
        expect(appointmentStateDisplay(appointment({ status: "CANCELLED" })).label).toBe("Cancelled");
    });

    it("appointmentCountsAsPlanned excludes cancelled", () => {
        expect(appointmentCountsAsPlanned(appointment({ status: "NO_SHOW" }))).toBe(false);
        expect(appointmentCountsAsPlanned(appointment({ status: "PLANNED" }))).toBe(true);
    });
});
