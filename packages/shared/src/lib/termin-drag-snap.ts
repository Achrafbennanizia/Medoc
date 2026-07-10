import type { Abwesenheit } from "../models/types";
import {
    dayKeyFromIsoDate,
    isCalendarDaySelectable,
    resolveBookingArbeitszeitenForArzt,
    type PraxisArbeitszeitenConfig,
} from "./praxis-planning";
import { isTerminSpanSchedulable, uhrzeitToMinutes } from "./termin-availability";

export type TerminDragSnapResult = {
    startMin: number;
    dayAllowed: boolean;
    slotAllowed: boolean;
};

/** Segment span for packing / clamping on a specific calendar day. */
export function deriveDayPackingBounds(
    praxisCfg: PraxisArbeitszeitenConfig,
    arztId: string,
    isoDate: string,
): { startMin: number; endMin: number } | null {
    const eff = resolveBookingArbeitszeitenForArzt(praxisCfg, arztId);
    const day = eff.plan[dayKeyFromIsoDate(isoDate)];
    if (!day?.aktiv) return null;
    let startMin = Number.POSITIVE_INFINITY;
    let endMin = Number.NEGATIVE_INFINITY;
    for (const seg of day.segments ?? []) {
        if (!seg.from || !seg.to || seg.from >= seg.to) continue;
        startMin = Math.min(startMin, uhrzeitToMinutes(seg.from));
        endMin = Math.max(endMin, uhrzeitToMinutes(seg.to));
    }
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) return null;
    return { startMin, endMin };
}

function listSchedulableStartMinutes(
    eff: PraxisArbeitszeitenConfig,
    abwesenheiten: Abwesenheit[],
    isoDate: string,
    durMin: number,
): number[] {
    const step = Math.max(5, Number(eff.slotMin) || 30);
    const day = eff.plan[dayKeyFromIsoDate(isoDate)];
    if (!day?.aktiv) return [];
    const out: number[] = [];
    const seen = new Set<number>();
    for (const seg of day.segments ?? []) {
        if (!seg.from || !seg.to || seg.from >= seg.to) continue;
        const segStart = uhrzeitToMinutes(seg.from);
        const segEnd = uhrzeitToMinutes(seg.to);
        for (let m = segStart; m + durMin <= segEnd; m += step) {
            if (!isTerminSpanSchedulable(eff, abwesenheiten, isoDate, m, m + durMin)) continue;
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
    for (const v of candidates) {
        const d = Math.abs(raw - v);
        if (d < bestDist) {
            bestDist = d;
            best = v;
        }
    }
    return best;
}

/**
 * Snap a drag position to the practice booking grid (segments, pause, closures, absences).
 * Used live while dragging Termine on the calendar.
 */
export function snapTerminDragPosition(opts: {
    praxisCfg: PraxisArbeitszeitenConfig;
    abwesenheiten: Abwesenheit[];
    arztId: string;
    isoDate: string;
    rawStartMin: number;
    durMin: number;
    timelineBounds: { startMin: number; endMin: number };
}): TerminDragSnapResult {
    const dayAllowed = isCalendarDaySelectable(opts.praxisCfg, opts.isoDate, opts.arztId);
    if (!dayAllowed) {
        const lo = opts.timelineBounds.startMin;
        const hi = opts.timelineBounds.endMin - opts.durMin;
        return {
            startMin: Math.max(lo, Math.min(opts.rawStartMin, hi)),
            dayAllowed: false,
            slotAllowed: false,
        };
    }

    const eff = resolveBookingArbeitszeitenForArzt(opts.praxisCfg, opts.arztId);
    const valid = listSchedulableStartMinutes(eff, opts.abwesenheiten, opts.isoDate, opts.durMin);
    if (valid.length === 0) {
        const bounds = deriveDayPackingBounds(opts.praxisCfg, opts.arztId, opts.isoDate);
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
