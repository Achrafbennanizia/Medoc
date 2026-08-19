import type { Absence, Appointment } from "../models/types";
import { parseAppointmentDurationMin } from "./appointment-domain";
import {
    dayKeyFromIsoDate,
    resolveBookingWorkHoursForPhysician,
    type PracticeWorkHoursConfig,
} from "./practice-planning";
import {
    isAppointmentSpanSchedulable,
    minutesToTime,
    timeToMinutes,
} from "./appointment-availability";

export type AppointmentSlotGrid = {
    /** All candidate start times for the selected day (practice + doctor hours). */
    slots: string[];
    /** Keys `yyyy-MM-dd|HH:mm` that can be booked for the requested duration. */
    bookableKeys: Set<string>;
};

function slotKey(date: string, hm: string): string {
    return `${date}|${hm.slice(0, 5)}`;
}

/** True when [startMin, startMin+durMin) overlaps an existing Appointment for the same Physician (incl. buffer). */
export function hasAppointmentOverlapForPhysician(
    appointments: Appointment[],
    date: string,
    physicianId: string,
    startMin: number,
    durMin: number,
    bufferMin: number,
    excludeAppointmentId?: string,
    defaultExistingDurMin = 30,
): boolean {
    if (!physicianId.trim()) return true;
    const gap = Math.max(0, bufferMin);
    const endMin = startMin + durMin;
    for (const t of appointments) {
        if (excludeAppointmentId && t.id === excludeAppointmentId) continue;
        if (t.status === "CANCELLED" || t.status === "NO_SHOW") continue;
        if (t.date !== date || t.physician_id !== physicianId) continue;
        const tStart = timeToMinutes(t.time);
        const tDur = parseAppointmentDurationMin(t.notes, defaultExistingDurMin);
        const tEnd = tStart + tDur + gap;
        if (startMin < tEnd && endMin > tStart) return true;
    }
    return false;
}

/**
 * Builds the time grid for Appointment create/edit from practice hours, absences,
 * existing appointments, slot step, duration, and buffer preferences.
 */
export function buildAppointmentSlotGrid(opts: {
    practiceCfg: PracticeWorkHoursConfig;
    absences: Absence[];
    date: string;
    physicianId: string;
    appointments: Appointment[];
    durMin: number;
    bufferMin: number;
    excludeAppointmentId?: string;
    defaultAppointmentDurMin?: number;
}): AppointmentSlotGrid {
    const eff = resolveBookingWorkHoursForPhysician(opts.practiceCfg, opts.physicianId);
    const step = Math.max(5, Number(eff.slotMin) || 30);
    const durMin = Math.max(5, opts.durMin);
    const defaultDur = opts.defaultAppointmentDurMin ?? step;
    const day = eff.plan[dayKeyFromIsoDate(opts.date)];
    const slots: string[] = [];
    const bookableKeys = new Set<string>();

    if (!opts.physicianId.trim() || !day?.active) {
        return { slots, bookableKeys };
    }

    const seen = new Set<string>();
    for (const seg of day.segments ?? []) {
        if (!seg.from || !seg.to || seg.from >= seg.to) continue;
        const segStart = timeToMinutes(seg.from);
        const segEnd = timeToMinutes(seg.to);
        for (let m = segStart; m + durMin <= segEnd; m += step) {
            const hm = minutesToTime(m);
            if (seen.has(hm)) continue;
            seen.add(hm);
            slots.push(hm);
            const endMin = m + durMin;
            if (!isAppointmentSpanSchedulable(eff, opts.absences, opts.date, m, endMin)) continue;
            if (
                hasAppointmentOverlapForPhysician(
                    opts.appointments,
                    opts.date,
                    opts.physicianId,
                    m,
                    durMin,
                    opts.bufferMin,
                    opts.excludeAppointmentId,
                    defaultDur,
                )
            ) {
                continue;
            }
            bookableKeys.add(slotKey(opts.date, hm));
        }
    }

    slots.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    return { slots, bookableKeys };
}

/** First bookable slot on a day, or undefined when none. */
export function firstBookableAppointmentSlot(grid: AppointmentSlotGrid, date: string): string | undefined {
    for (const hm of grid.slots) {
        if (grid.bookableKeys.has(slotKey(date, hm))) return hm;
    }
    return undefined;
}

export function durationOptionsForSlotMin(slotMin: number): string[] {
    const base = Math.max(5, Number(slotMin) || 30);
    const values = new Set<number>([base, 15, 30, 45, 60, 90, 120]);
    return [...values].filter((version) => version >= base && version <= 240).sort((a, b) => a - b).map(String);
}
