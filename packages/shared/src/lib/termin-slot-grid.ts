import type { Abwesenheit, Termin } from "../models/types";
import { parseTerminDurationMin } from "./termin-domain";
import {
    dayKeyFromIsoDate,
    resolveBookingArbeitszeitenForArzt,
    type PraxisArbeitszeitenConfig,
} from "./praxis-planning";
import {
    isTerminSpanSchedulable,
    minutesToUhrzeit,
    uhrzeitToMinutes,
} from "./termin-availability";

export type TerminSlotGrid = {
    /** All candidate start times for the selected day (practice + doctor hours). */
    slots: string[];
    /** Keys `yyyy-MM-dd|HH:mm` that can be booked for the requested duration. */
    bookableKeys: Set<string>;
};

function slotKey(datum: string, hm: string): string {
    return `${datum}|${hm.slice(0, 5)}`;
}

/** True when [startMin, startMin+durMin) overlaps an existing Termin for the same Arzt (incl. buffer). */
export function hasTerminOverlapForArzt(
    termine: Termin[],
    datum: string,
    arztId: string,
    startMin: number,
    durMin: number,
    pufferMin: number,
    excludeTerminId?: string,
    defaultExistingDurMin = 30,
): boolean {
    if (!arztId.trim()) return true;
    const gap = Math.max(0, pufferMin);
    const endMin = startMin + durMin;
    for (const t of termine) {
        if (excludeTerminId && t.id === excludeTerminId) continue;
        if (t.status === "ABGESAGT" || t.status === "NICHT_ERSCHIENEN") continue;
        if (t.datum !== datum || t.arzt_id !== arztId) continue;
        const tStart = uhrzeitToMinutes(t.uhrzeit);
        const tDur = parseTerminDurationMin(t.notizen, defaultExistingDurMin);
        const tEnd = tStart + tDur + gap;
        if (startMin < tEnd && endMin > tStart) return true;
    }
    return false;
}

/**
 * Builds the time grid for Termin create/edit from practice hours, absences,
 * existing appointments, slot step, duration, and buffer preferences.
 */
export function buildTerminSlotGrid(opts: {
    praxisCfg: PraxisArbeitszeitenConfig;
    abwesenheiten: Abwesenheit[];
    datum: string;
    arztId: string;
    termine: Termin[];
    durMin: number;
    pufferMin: number;
    excludeTerminId?: string;
    defaultTerminDurMin?: number;
}): TerminSlotGrid {
    const eff = resolveBookingArbeitszeitenForArzt(opts.praxisCfg, opts.arztId);
    const step = Math.max(5, Number(eff.slotMin) || 30);
    const durMin = Math.max(5, opts.durMin);
    const defaultDur = opts.defaultTerminDurMin ?? step;
    const day = eff.plan[dayKeyFromIsoDate(opts.datum)];
    const slots: string[] = [];
    const bookableKeys = new Set<string>();

    if (!opts.arztId.trim() || !day?.aktiv) {
        return { slots, bookableKeys };
    }

    const seen = new Set<string>();
    for (const seg of day.segments ?? []) {
        if (!seg.from || !seg.to || seg.from >= seg.to) continue;
        const segStart = uhrzeitToMinutes(seg.from);
        const segEnd = uhrzeitToMinutes(seg.to);
        for (let m = segStart; m + durMin <= segEnd; m += step) {
            const hm = minutesToUhrzeit(m);
            if (seen.has(hm)) continue;
            seen.add(hm);
            slots.push(hm);
            const endMin = m + durMin;
            if (!isTerminSpanSchedulable(eff, opts.abwesenheiten, opts.datum, m, endMin)) continue;
            if (
                hasTerminOverlapForArzt(
                    opts.termine,
                    opts.datum,
                    opts.arztId,
                    m,
                    durMin,
                    opts.pufferMin,
                    opts.excludeTerminId,
                    defaultDur,
                )
            ) {
                continue;
            }
            bookableKeys.add(slotKey(opts.datum, hm));
        }
    }

    slots.sort((a, b) => uhrzeitToMinutes(a) - uhrzeitToMinutes(b));
    return { slots, bookableKeys };
}

/** First bookable slot on a day, or undefined when none. */
export function firstBookableTerminSlot(grid: TerminSlotGrid, datum: string): string | undefined {
    for (const hm of grid.slots) {
        if (grid.bookableKeys.has(slotKey(datum, hm))) return hm;
    }
    return undefined;
}

export function durationOptionsForSlotMin(slotMin: number): string[] {
    const base = Math.max(5, Number(slotMin) || 30);
    const values = new Set<number>([base, 15, 30, 45, 60, 90, 120]);
    return [...values].filter((v) => v >= base && v <= 240).sort((a, b) => a - b).map(String);
}
