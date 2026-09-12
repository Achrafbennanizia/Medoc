import type { Absence } from "../models/types";
import {
    dayKeyFromIsoDate,
    isCalendarDaySelectable,
    resolveBookingWorkHoursForPhysician,
    type PracticeWorkHoursConfig,
} from "./practice-planning";
import { isAppointmentSpanSchedulable, timeToMinutes } from "./appointment-availability";
import { listOpenWorkIntervals } from "./appointment-calendar-layout";

export type AppointmentDragSnapResult = {
    startMin: number;
    dayAllowed: boolean;
    slotAllowed: boolean;
};

/** Segment span for packing / clamping on a specific calendar day. */
export function deriveDayPackingBounds(
    practiceCfg: PracticeWorkHoursConfig,
    physicianId: string,
    isoDate: string,
): { startMin: number; endMin: number } | null {
    const eff = resolveBookingWorkHoursForPhysician(practiceCfg, physicianId);
    const day = eff.plan[dayKeyFromIsoDate(isoDate)];
    if (!day?.active) return null;
    let startMin = Number.POSITIVE_INFINITY;
    let endMin = Number.NEGATIVE_INFINITY;
    for (const seg of day.segments ?? []) {
        if (!seg.from || !seg.to || seg.from >= seg.to) continue;
        startMin = Math.min(startMin, timeToMinutes(seg.from));
        endMin = Math.max(endMin, timeToMinutes(seg.to));
    }
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
    return { startMin, endMin };
}

/** Live calendar drag snaps on a fine 5-minute grid (not the coarser create-slot step). */
export const APPOINTMENT_DRAG_SNAP_STEP_MIN = 5;

function listSchedulableStartMinutes(
    eff: PracticeWorkHoursConfig,
    absences: Absence[],
    isoDate: string,
    durMin: number,
): number[] {
    const step = APPOINTMENT_DRAG_SNAP_STEP_MIN;
    const out: number[] = [];
    const seen = new Set<number>();
    // Step inside each open band (post-break band starts at break end — not the next morning tick).
    for (const band of listOpenWorkIntervals(eff, isoDate)) {
        for (let m = band.startMin; m + durMin <= band.endMin; m += step) {
            if (!isAppointmentSpanSchedulable(eff, absences, isoDate, m, m + durMin)) continue;
            if (seen.has(m)) continue;
            seen.add(m);
            out.push(m);
        }
    }
    out.sort((a, b) => a - b);
    return out;
}

function nearestMinute(candidates: number[], raw: number): number | null {
    if (candidates.length === 0) return null;
    let best = candidates[0]!;
    let bestDist = Math.abs(raw - best);
    for (const version of candidates) {
        const d = Math.abs(raw - version);
        if (d < bestDist) {
            bestDist = d;
            best = version;
        }
    }
    return best;
}

/**
 * Snap a drag position to the practice booking grid (segments, pause, closures, absences).
 * Used live while dragging Appointments on the calendar.
 */
export function snapAppointmentDragPosition(opts: {
    practiceCfg: PracticeWorkHoursConfig;
    absences: Absence[];
    physicianId: string;
    isoDate: string;
    rawStartMin: number;
    durMin: number;
    timelineBounds: { startMin: number; endMin: number };
}): AppointmentDragSnapResult {
    const dayAllowed = isCalendarDaySelectable(opts.practiceCfg, opts.isoDate, opts.physicianId);
    if (!dayAllowed) {
        const lo = opts.timelineBounds.startMin;
        const hi = opts.timelineBounds.endMin - opts.durMin;
        return {
            startMin: Math.max(lo, Math.min(opts.rawStartMin, hi)),
            dayAllowed: false,
            slotAllowed: false,
        };
    }

    const eff = resolveBookingWorkHoursForPhysician(opts.practiceCfg, opts.physicianId);
    const valid = listSchedulableStartMinutes(eff, opts.absences, opts.isoDate, opts.durMin);
    if (valid.length === 0) {
        const bounds = deriveDayPackingBounds(opts.practiceCfg, opts.physicianId, opts.isoDate);
        const lo = bounds?.startMin ?? opts.timelineBounds.startMin;
        const hi = (bounds?.endMin ?? opts.timelineBounds.endMin) - opts.durMin;
        return {
            startMin: Math.max(lo, Math.min(opts.rawStartMin, hi)),
            dayAllowed: true,
            slotAllowed: false,
        };
    }

    const snapped = nearestMinute(valid, opts.rawStartMin) ?? valid[0]!;
    return { startMin: snapped, dayAllowed: true, slotAllowed: true };
}
