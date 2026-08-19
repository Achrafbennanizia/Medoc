import { appointmentIsEmergencyMarked, type AppointmentKindNotes } from "@/lib/appointment-domain";
import { minutesToTime } from "@/lib/appointment-availability";
import { t } from "@/lib/i18n";
import type { Appointment } from "@/models/types";
import type { PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";

export type AppointmentBadgeVariant = "primary" | "success" | "default" | "error" | "warning";

export const APPOINTMENT_STATUS_BADGE: Record<string, AppointmentBadgeVariant> = {
    PLANNED: "primary",
    CONFIRMED: "success",
    COMPLETED: "default",
    NO_SHOW: "error",
    CANCELLED: "warning",
};

const APPOINTMENT_KIND_KEYS = [
    "FIRST_VISIT",
    "EXAMINATION",
    "CHECKUP",
    "TREATMENT",
    "EMERGENCY",
    "CONSULTATION",
] as const;

/** @deprecated Prefer `appointmentKindFilterOptions()` for localized labels. */
export const APPOINTMENT_KIND_FILTER_OPTIONS = APPOINTMENT_KIND_KEYS.map((value) => ({
    value,
    label: value,
}));

export function appointmentKindFilterOptions(): Array<{ value: string; label: string }> {
    return APPOINTMENT_KIND_KEYS.map((value) => ({
        value,
        label: t(`appointment.kind.${value}`),
    }));
}

export function appointmentEmergencyConfirmTitle(): string {
    return t("appointment.calendar.emergency_confirm_title");
}

export function appointmentEmergencyConfirmMessage(): string {
    return t("appointment.calendar.emergency_confirm_message");
}

import {
    APPOINTMENT_TIMELINE_DEFAULT_END_MIN,
    APPOINTMENT_TIMELINE_DEFAULT_START_MIN,
} from "./appointment-calendar-layout";

/** @deprecated Prefer {@link deriveAppointmentTimelineBounds} with practice config. */
export const APPOINTMENT_DAY_START_MIN = APPOINTMENT_TIMELINE_DEFAULT_START_MIN;
/** @deprecated Prefer {@link deriveAppointmentTimelineBounds} with practice config. */
export const APPOINTMENT_DAY_END_MIN = APPOINTMENT_TIMELINE_DEFAULT_END_MIN;
export const APPOINTMENT_DEFAULT_DUR_MIN = 45;
export const APPOINTMENT_HOUR_PX = 84;
export const APPOINTMENT_PX_PER_MIN = 1.4;

export const APPOINTMENT_EVENT_TONE_BY_KIND: Record<string, "blue" | "accent" | "orange" | "purple" | "green"> = {
    FIRST_VISIT: "blue",
    CHECKUP: "green",
    TREATMENT: "accent",
    EXAMINATION: "blue",
    CONSULTATION: "purple",
};

export type AppointmentBlockTone = "green" | "blue" | "accent" | "orange" | "purple";

export const APPOINTMENT_DOCTOR_TONE_CYCLE = ["green", "blue", "purple", "accent"] as const;
export type AppointmentDoctorTone = (typeof APPOINTMENT_DOCTOR_TONE_CYCLE)[number];

type AppointmentDisplayState = "cancelled" | "done" | "edited" | "confirmed" | "planned";

const APPOINTMENT_STATE_VARIANT: Record<AppointmentDisplayState, AppointmentBadgeVariant> = {
    cancelled: "error",
    done: "success",
    edited: "warning",
    confirmed: "success",
    planned: "primary",
};

const APPOINTMENT_STATE_LABEL_KEY: Record<AppointmentDisplayState, string> = {
    cancelled: "appointment.status.cancelled",
    done: "appointment.status.completed",
    edited: "appointment.status.changed",
    confirmed: "appointment.status.confirmed",
    planned: "appointment.status.planned",
};

const CALENDAR_PILL_LABEL_KEY: Record<AppointmentDisplayState, string> = {
    cancelled: "appointment.calendar.status.cancelled",
    done: "appointment.calendar.status.done",
    edited: "appointment.calendar.status.changed",
    confirmed: "appointment.calendar.status.in_treatment",
    planned: "appointment.calendar.status.planned",
};

function resolveAppointmentDisplayState(appointment: Appointment): AppointmentDisplayState {
    if (appointment.status === "CANCELLED" || appointment.status === "NO_SHOW") {
        return "cancelled";
    }
    if (appointment.status === "COMPLETED") {
        return "done";
    }
    const editedMs = new Date(appointment.updated_at).getTime() - new Date(appointment.created_at).getTime();
    const edited = editedMs > 60_000;
    if (edited && (appointment.status === "PLANNED" || appointment.status === "CONFIRMED")) {
        return "edited";
    }
    if (appointment.status === "CONFIRMED") {
        return "confirmed";
    }
    return "planned";
}

export function appointmentKindLabel(kind: string): string {
    const key = `appointment.kind.${kind}`;
    const label = t(key);
    return label !== key ? label : kind.replace(/_/g, " ");
}

export function appointmentKindLabelFromAppointment(appointment: Appointment): string {
    if (appointmentIsEmergencyMarked(appointment)) return t("appointment.calendar.emergency_label");
    return appointmentKindLabel(appointment.kind);
}

export function appointmentStateDisplay(appointment: Appointment): { label: string; variant: AppointmentBadgeVariant } {
    const state = resolveAppointmentDisplayState(appointment);
    return { label: t(APPOINTMENT_STATE_LABEL_KEY[state]), variant: APPOINTMENT_STATE_VARIANT[state] };
}

export function stateSoftPillClass(appointment: Appointment): string {
    switch (resolveAppointmentDisplayState(appointment)) {
        case "cancelled":
            return "red";
        case "done":
            return "accent";
        case "edited":
            return "yellow";
        case "confirmed":
            return "blue";
        default:
            return "grey";
    }
}

export function appointmentCalendarStatusPill(appointment: Appointment): {
    label: string;
    tone: "active" | "planned" | "done" | "cancel" | "edit";
} {
    const state = resolveAppointmentDisplayState(appointment);
    const toneByState: Record<AppointmentDisplayState, "active" | "planned" | "done" | "cancel" | "edit"> = {
        cancelled: "cancel",
        done: "done",
        edited: "edit",
        confirmed: "active",
        planned: "planned",
    };
    return { label: t(CALENDAR_PILL_LABEL_KEY[state]), tone: toneByState[state] };
}

export function appointmentTimeToMinutes(u: string): number {
    const p = u.slice(0, 5).split(":");
    const h = Number(p[0]);
    const m = Number(p[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return APPOINTMENT_DAY_START_MIN;
    return h * 60 + m;
}

export { minutesToTime, timeToMinutes } from "@/lib/appointment-availability";

export function buildPhysicianToneMap(physicians: PhysicianSummary[]): Map<string, AppointmentDoctorTone> {
    const m = new Map<string, AppointmentDoctorTone>();
    physicians.forEach((a, i) => m.set(a.id, APPOINTMENT_DOCTOR_TONE_CYCLE[i % APPOINTMENT_DOCTOR_TONE_CYCLE.length]!));
    return m;
}

export function blockToneForAppointment(
    event: AppointmentKindNotes,
    doctorTone: AppointmentDoctorTone,
): AppointmentBlockTone {
    if (appointmentIsEmergencyMarked(event)) return "orange";
    const fromKind = APPOINTMENT_EVENT_TONE_BY_KIND[event.kind];
    if (fromKind) return fromKind;
    return doctorTone;
}

export function doctorStripeVar(tone: AppointmentDoctorTone): string {
    if (tone === "green") return "var(--green)";
    if (tone === "blue") return "var(--blue)";
    if (tone === "purple") return "var(--purple)";
    return "var(--accent)";
}

export function appointmentCountsAsPlanned(t: Appointment): boolean {
    return t.status !== "CANCELLED" && t.status !== "NO_SHOW";
}

export function computePackedUpdatesAfterMove(
    all: Appointment[],
    movingId: string,
    targetDate: string,
    desiredStartMin: number,
    slotDur: number,
    gapAfterMin: number,
    dayBounds?: { startMin: number; endMin: number },
): { updates: { id: string; data: Record<string, unknown> }[]; error?: string } {
    const dayStartMin = dayBounds?.startMin ?? APPOINTMENT_DAY_START_MIN;
    const dayEndMin = dayBounds?.endMin ?? APPOINTMENT_DAY_END_MIN;
    const moving = all.find((t) => t.id === movingId);
    if (!moving) return { updates: [] };

    const physicianId = moving.physician_id;
    const step = 5;
    let start = Math.round(desiredStartMin / step) * step;
    start = Math.max(dayStartMin, Math.min(start, dayEndMin - slotDur));

    type Bl = { id: string; start: number };
    const blocks: Bl[] = all
        .filter(
            (t) =>
                t.date === targetDate &&
                t.physician_id === physicianId &&
                appointmentCountsAsPlanned(t) &&
                t.id !== movingId,
        )
        .map((t) => ({ id: t.id, start: appointmentTimeToMinutes(t.time) }));

    blocks.push({ id: movingId, start });

    const gap = Math.max(0, Math.floor(Number(gapAfterMin) || 0));
    const endOf = (s: number) => s + slotDur + gap;

    let guard = 0;
    let changed = true;
    while (changed && guard++ < 80) {
        changed = false;
        blocks.sort((a, b) => a.start - b.start);
        for (let i = 0; i < blocks.length - 1; i++) {
            const endI = endOf(blocks[i]!.start);
            if (endI > blocks[i + 1]!.start) {
                let ns = endI;
                ns = Math.ceil(ns / step) * step;
                if (ns < endI) ns += step;
                blocks[i + 1]!.start = ns;
                changed = true;
            }
        }
    }

    for (const b of blocks) {
        if (b.start + slotDur > dayEndMin) {
            return {
                updates: [],
                error: t("appointment.calendar.move_no_space"),
            };
        }
    }

    const updates: { id: string; data: Record<string, unknown> }[] = [];
    for (const b of blocks) {
        const t = all.find((x) => x.id === b.id);
        if (!t) continue;
        const newU = minutesToTime(b.start);
        const uCmp = t.time.slice(0, 5);
        const newUCmp = newU.slice(0, 5);
        if (b.id === movingId) {
            if (t.date !== targetDate || uCmp !== newUCmp) {
                updates.push({ id: b.id, data: { date: targetDate, time: newU } });
            }
        } else if (uCmp !== newUCmp) {
            updates.push({ id: b.id, data: { time: newU } });
        }
    }

    return { updates };
}

export function calendarMonthOffsetFromToday(d: Date): number {
    const now = new Date();
    return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

export {
    APPOINTMENT_CALENDAR_MONTH_ROWS,
    APPOINTMENT_CALENDAR_WORKING_DAYS,
    buildAppointmentMonthCalendarCells,
    deriveDayClosedSpans,
    deriveDayTimelineBounds,
    deriveAppointmentTimelineBounds,
    deriveWeekTimelineBounds,
    isAppointmentCalendarWorkingDay,
    appointmentCalendarColumnCount,
    appointmentCalendarIsoWeekdayOffsets,
    appointmentCalendarWeekDays,
    appointmentCalendarWeekdayLabelKeys,
    appointmentCalendarWorkingDayIndex,
    appointmentTimelineHourLabels,
    type AppointmentTimelineBounds,
} from "./appointment-calendar-layout";
