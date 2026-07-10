import { addDays } from "date-fns";
import {
    dayKeyFromIsoDate,
    PRAXIS_DAY_KEYS,
    type PraxisArbeitszeitenConfig,
    type PraxisDayKey,
    resolveEffectiveArbeitszeitenForArzt,
} from "./praxis-planning";
import { uhrzeitToMinutes } from "./termin-availability";

/** Broadcast when practice hours change (save or background refresh). */
export const PRAXIS_ARBEITSZEITEN_CHANGED_EVENT = "medoc:praxis-arbeitszeiten-changed";

/** Fallback when no practice days are active. */
export const TERMIN_TIMELINE_DEFAULT_START_MIN = 8 * 60;
export const TERMIN_TIMELINE_DEFAULT_END_MIN = 19 * 60;

export const TERMIN_CALENDAR_MONTH_ROWS = 6;

const ISO_WEEKDAY_OFFSET: Record<PraxisDayKey, number> = {
    mo: 0,
    di: 1,
    mi: 2,
    do: 3,
    fr: 4,
    sa: 5,
    so: 6,
};

const WEEKDAY_I18N_KEYS: Record<PraxisDayKey, string> = {
    mo: "termin.calendar.weekday.mon",
    di: "termin.calendar.weekday.tue",
    mi: "termin.calendar.weekday.wed",
    do: "termin.calendar.weekday.thu",
    fr: "termin.calendar.weekday.fri",
    sa: "termin.calendar.weekday.sat",
    so: "termin.calendar.weekday.sun",
};

/** Active practice days in Mon→Sun order. */
export function activePraxisDayKeys(cfg: PraxisArbeitszeitenConfig): PraxisDayKey[] {
    return PRAXIS_DAY_KEYS.filter((key) => cfg.plan[key]?.aktiv);
}

/**
 * Calendar columns: active days from the first active weekday through the last
 * active weekday (e.g. Mon–Fri default, Mon–Sat when Saturday is enabled).
 */
export function terminCalendarColumnDayKeys(cfg: PraxisArbeitszeitenConfig): PraxisDayKey[] {
    const active = activePraxisDayKeys(cfg);
    if (active.length === 0) {
        return ["mo", "di", "mi", "do", "fr"];
    }
    const first = PRAXIS_DAY_KEYS.indexOf(active[0]!);
    const last = PRAXIS_DAY_KEYS.indexOf(active[active.length - 1]!);
    return PRAXIS_DAY_KEYS.slice(first, last + 1).filter((key) => cfg.plan[key]?.aktiv);
}

export function terminCalendarColumnCount(cfg: PraxisArbeitszeitenConfig): number {
    return terminCalendarColumnDayKeys(cfg).length;
}

/** ISO week offsets (Mon=0 … Sun=6) for visible calendar columns. */
export function terminCalendarIsoWeekdayOffsets(cfg: PraxisArbeitszeitenConfig): number[] {
    return terminCalendarColumnDayKeys(cfg).map((key) => ISO_WEEKDAY_OFFSET[key]);
}

export function terminCalendarWeekdayLabelKeys(cfg: PraxisArbeitszeitenConfig): string[] {
    return terminCalendarColumnDayKeys(cfg).map((key) => WEEKDAY_I18N_KEYS[key]);
}

/** @deprecated Prefer {@link terminCalendarColumnCount} with practice config. */
export const TERMIN_CALENDAR_WORKING_DAYS = 5;

export function isTerminCalendarWorkingDay(date: Date, cfg?: PraxisArbeitszeitenConfig): boolean {
    if (!cfg) {
        const dow = date.getDay();
        return dow >= 1 && dow <= 5;
    }
    const js = date.getDay();
    const map: PraxisDayKey[] = ["so", "mo", "di", "mi", "do", "fr", "sa"];
    const key = map[js];
    return key ? Boolean(cfg.plan[key]?.aktiv) : false;
}

/** Index within visible columns for a date, or -1 when hidden. */
export function terminCalendarWorkingDayIndex(date: Date, cfg: PraxisArbeitszeitenConfig): number {
    const js = date.getDay();
    const map: PraxisDayKey[] = ["so", "mo", "di", "mi", "do", "fr", "sa"];
    const key = map[js];
    if (!key || !cfg.plan[key]?.aktiv) return -1;
    const offsets = terminCalendarIsoWeekdayOffsets(cfg);
    const isoOffset = js === 0 ? 6 : js - 1;
    return offsets.indexOf(isoOffset);
}

export function terminCalendarWeekDays(weekAnchorMonday: Date, cfg: PraxisArbeitszeitenConfig): Date[] {
    return terminCalendarIsoWeekdayOffsets(cfg).map((offset) => addDays(weekAnchorMonday, offset));
}

export function buildTerminMonthCalendarCells(gridStartMonday: Date, cfg: PraxisArbeitszeitenConfig): Date[] {
    const offsets = terminCalendarIsoWeekdayOffsets(cfg);
    const cells: Date[] = [];
    for (let row = 0; row < TERMIN_CALENDAR_MONTH_ROWS; row += 1) {
        for (const offset of offsets) {
            cells.push(addDays(gridStartMonday, row * 7 + offset));
        }
    }
    return cells;
}

export type TerminTimelineBounds = {
    startMin: number;
    endMin: number;
};

/** Visible hour range for day/week timelines — union of all active day segments. */
export function deriveTerminTimelineBounds(
    cfg: PraxisArbeitszeitenConfig,
    arztId?: string | null,
): TerminTimelineBounds {
    const eff = resolveEffectiveArbeitszeitenForArzt(cfg, arztId);
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = 0;
    for (const key of PRAXIS_DAY_KEYS) {
        const day = eff.plan[key];
        if (!day?.aktiv) continue;
        for (const seg of day.segments ?? []) {
            if (!seg.from || !seg.to) continue;
            minStart = Math.min(minStart, uhrzeitToMinutes(seg.from));
            maxEnd = Math.max(maxEnd, uhrzeitToMinutes(seg.to));
        }
    }
    if (!Number.isFinite(minStart) || maxEnd <= minStart) {
        return { startMin: TERMIN_TIMELINE_DEFAULT_START_MIN, endMin: TERMIN_TIMELINE_DEFAULT_END_MIN };
    }
    const startMin = Math.max(0, Math.floor(minStart / 60) * 60);
    const endMin = Math.min(24 * 60, Math.max(Math.ceil(maxEnd / 60) * 60, startMin + 60));
    return { startMin, endMin };
}

export function deriveDayTimelineBounds(
    cfg: PraxisArbeitszeitenConfig,
    isoDate: string,
    arztId?: string | null,
): TerminTimelineBounds {
    const eff = resolveEffectiveArbeitszeitenForArzt(cfg, arztId);
    const day = eff.plan[dayKeyFromIsoDate(isoDate)];
    if (!day?.aktiv) {
        return { startMin: TERMIN_TIMELINE_DEFAULT_START_MIN, endMin: TERMIN_TIMELINE_DEFAULT_END_MIN };
    }
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = 0;
    for (const seg of day.segments ?? []) {
        if (!seg.from || !seg.to) continue;
        minStart = Math.min(minStart, uhrzeitToMinutes(seg.from));
        maxEnd = Math.max(maxEnd, uhrzeitToMinutes(seg.to));
    }
    if (!Number.isFinite(minStart) || maxEnd <= minStart) {
        return deriveTerminTimelineBounds(cfg, arztId);
    }
    const startMin = Math.max(0, Math.floor(minStart / 60) * 60);
    const endMin = Math.min(24 * 60, Math.max(Math.ceil(maxEnd / 60) * 60, startMin + 60));
    return { startMin, endMin };
}

export function terminTimelineHourLabels(bounds: TerminTimelineBounds): number[] {
    const hours: number[] = [];
    for (let m = bounds.startMin; m < bounds.endMin; m += 60) {
        hours.push(Math.floor(m / 60));
    }
    return hours;
}
