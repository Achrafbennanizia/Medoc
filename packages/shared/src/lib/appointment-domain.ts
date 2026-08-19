import type { Appointment as TCalRow } from "@/models/types";

/** Embedded in `appointment.notes` when “Emergency” was chosen in the calendar flow. */
export const APPOINTMENT_EMERGENCY_NOTE_MARKER = "Priority: emergency (marked from calendar)";

/** Emergency slots are persisted as `TREATMENT` plus this marker in notes. */
type AppointmentKindNotes = Pick<TCalRow, "kind" | "notes">;
export type { AppointmentKindNotes };
export function appointmentIsEmergencyMarked(t: AppointmentKindNotes): boolean {
    return t.kind === "TREATMENT" && Boolean(t.notes?.includes(APPOINTMENT_EMERGENCY_NOTE_MARKER));
}

const APPOINTMENT_DURATION_RE = /(?:Duration|Dauer):\s*(\d+)\s*min/i;

/** Reads duration from `appointment.notes` (`Duration: N min`; leftover `Dauer:`). */
export function parseAppointmentDurationMin(notes: string | null | undefined, fallback = 30): number {
    const m = APPOINTMENT_DURATION_RE.exec(notes ?? "");
    const n = m ? Number(m[1]) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
}
