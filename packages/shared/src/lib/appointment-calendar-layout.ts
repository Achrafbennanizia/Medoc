import { addDays } from "date-fns";
import {
    dayKeyFromIsoDate,
    PRACTICE_DAY_KEYS,
    type PracticeWorkHoursConfig,
    type PracticeDayKey,
    resolveEffectiveWorkHoursForPhysician,
} from "./practice-planning";
import { timeToMinutes } from "./appointment-availability";

/** Broadcast when practice hours change (save or background refresh). */
export const PRACTICE_WORK_HOURS_CHANGED_EVENT = "medoc:practice-work_hours-changed";

/** Fallback when no practice days are active. */
export const APPOINTMENT_TIMELINE_DEFAULT_START_MIN = 8 * 60;
export const APPOINTMENT_TIMELINE_DEFAULT_END_MIN = 19 * 60;

export const APPOINTMENT_CALENDAR_MONTH_ROWS = 6;

const ISO_WEEKDAY_OFFSET: Record<PracticeDayKey, number> = {
    mo: 0,
    di: 1,
    mi: 2,
    do: 3,
    fr: 4,
    sa: 5,
    so: 6,
};

const WEEKDAY_I18N_KEYS: Record<PracticeDayKey, string> = {
    mo: "appointment.calendar.weekday.mon",
    di: "appointment.calendar.weekday.tue",
    mi: "appointment.calendar.weekday.wed",
    do: "appointment.calendar.weekday.thu",
    fr: "appointment.calendar.weekday.fri",
    sa: "appointment.calendar.weekday.sat",
    so: "appointment.calendar.weekday.sun",
};

/** Active practice days in Mon→Sun order. */
export function activePracticeDayKeys(cfg: PracticeWorkHoursConfig): PracticeDayKey[] {
    return PRACTICE_DAY_KEYS.filter((key) => cfg.plan[key]?.active);
}

/**
 * Calendar columns: active days from the first active weekday through the last
 * active weekday (e.g. Mon–Fri default, Mon–Sat when Saturday is enabled).
 */
export function appointmentCalendarColumnDayKeys(cfg: PracticeWorkHoursConfig): PracticeDayKey[] {
    const active = activePracticeDayKeys(cfg);
    if (active.length === 0) {
        return ["mo", "di", "mi", "do", "fr"];
    }
    const first = PRACTICE_DAY_KEYS.indexOf(active[0]!);
    const last = PRACTICE_DAY_KEYS.indexOf(active[active.length - 1]!);
    return PRACTICE_DAY_KEYS.slice(first, last + 1).filter((key) => cfg.plan[key]?.active);
}

export function appointmentCalendarColumnCount(cfg: PracticeWorkHoursConfig): number {
    return appointmentCalendarColumnDayKeys(cfg).length;
}

/** ISO week offsets (Mon=0 … Sun=6) for visible calendar columns. */
export function appointmentCalendarIsoWeekdayOffsets(cfg: PracticeWorkHoursConfig): number[] {
    return appointmentCalendarColumnDayKeys(cfg).map((key) => ISO_WEEKDAY_OFFSET[key]);
}

export function appointmentCalendarWeekdayLabelKeys(cfg: PracticeWorkHoursConfig): string[] {
    return appointmentCalendarColumnDayKeys(cfg).map((key) => WEEKDAY_I18N_KEYS[key]);
}

/** @deprecated Prefer {@link appointmentCalendarColumnCount} with practice config. */
export const APPOINTMENT_CALENDAR_WORKING_DAYS = 5;

export function isAppointmentCalendarWorkingDay(date: Date, cfg?: PracticeWorkHoursConfig): boolean {
    if (!cfg) {
        const dow = date.getDay();
        return dow >= 1 && dow <= 5;
    }
    const js = date.getDay();
    const map: PracticeDayKey[] = ["so", "mo", "di", "mi", "do", "fr", "sa"];
    const key = map[js];
    return key ? Boolean(cfg.plan[key]?.active) : false;
}

/** Index within visible columns for a date, or -1 when hidden. */
export function appointmentCalendarWorkingDayIndex(date: Date, cfg: PracticeWorkHoursConfig): number {
    const js = date.getDay();
    const map: PracticeDayKey[] = ["so", "mo", "di", "mi", "do", "fr", "sa"];
    const key = map[js];
    if (!key || !cfg.plan[key]?.active) return -1;
    const offsets = appointmentCalendarIsoWeekdayOffsets(cfg);
    const isoOffset = js === 0 ? 6 : js - 1;
    return offsets.indexOf(isoOffset);
}

export function appointmentCalendarWeekDays(weekAnchorMonday: Date, cfg: PracticeWorkHoursConfig): Date[] {
    return appointmentCalendarIsoWeekdayOffsets(cfg).map((offset) => addDays(weekAnchorMonday, offset));
}

export function buildAppointmentMonthCalendarCells(gridStartMonday: Date, cfg: PracticeWorkHoursConfig): Date[] {
    const offsets = appointmentCalendarIsoWeekdayOffsets(cfg);
    const cells: Date[] = [];
    for (let row = 0; row < APPOINTMENT_CALENDAR_MONTH_ROWS; row += 1) {
        for (const offset of offsets) {
            cells.push(addDays(gridStartMonday, row * 7 + offset));
        }
    }
    return cells;
}

export type AppointmentTimelineBounds = {
    startMin: number;
    endMin: number;
};

export type AppointmentClosedSpan = {
    fromMin: number;
    toMin: number;
};

function boundsFromSegments(
    segments: Array<{ from: string; to: string }>,
    _fallback: AppointmentTimelineBounds,
): AppointmentTimelineBounds | null {
    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = 0;
    for (const seg of segments) {
        if (!seg.from || !seg.to || seg.from >= seg.to) continue;
        minStart = Math.min(minStart, timeToMinutes(seg.from));
        maxEnd = Math.max(maxEnd, timeToMinutes(seg.to));
    }
    if (!Number.isFinite(minStart) || maxEnd <= minStart) return null;
    const startMin = Math.max(0, Math.floor(minStart / 60) * 60);
    const endMin = Math.min(24 * 60, Math.max(Math.ceil(maxEnd / 60) * 60, startMin + 60));
    return { startMin, endMin };
}

function mergeClosedSpans(spans: AppointmentClosedSpan[]): AppointmentClosedSpan[] {
    if (spans.length === 0) return [];
    const sorted = [...spans]
        .filter((s) => s.toMin > s.fromMin)
        .sort((a, b) => a.fromMin - b.fromMin);
    const out: AppointmentClosedSpan[] = [];
    for (const s of sorted) {
        const last = out[out.length - 1];
        if (last && s.fromMin <= last.toMin) {
            last.toMin = Math.max(last.toMin, s.toMin);
        } else {
            out.push({ ...s });
        }
    }
    return out;
}

/** Visible hour range for day/week timelines — union of all active practice day segments. */
export function deriveAppointmentTimelineBounds(
    cfg: PracticeWorkHoursConfig,
    physicianId?: string | null,
): AppointmentTimelineBounds {
    const eff = resolveEffectiveWorkHoursForPhysician(cfg, physicianId);
    const allSegments: Array<{ from: string; to: string }> = [];
    for (const key of PRACTICE_DAY_KEYS) {
        const day = eff.plan[key];
        if (!day?.active) continue;
        for (const seg of day.segments ?? []) {
            if (seg.from && seg.to && seg.from < seg.to) allSegments.push(seg);
        }
    }
    return boundsFromSegments(allSegments, {
        startMin: APPOINTMENT_TIMELINE_DEFAULT_START_MIN,
        endMin: APPOINTMENT_TIMELINE_DEFAULT_END_MIN,
    }) ?? {
        startMin: APPOINTMENT_TIMELINE_DEFAULT_START_MIN,
        endMin: APPOINTMENT_TIMELINE_DEFAULT_END_MIN,
    };
}

/** Timeline height for one calendar day from its practice segments. */
export function deriveDayTimelineBounds(
    cfg: PracticeWorkHoursConfig,
    isoDate: string,
    physicianId?: string | null,
): AppointmentTimelineBounds {
    const eff = resolveEffectiveWorkHoursForPhysician(cfg, physicianId);
    const day = eff.plan[dayKeyFromIsoDate(isoDate)];
    if (!day?.active) {
        return deriveAppointmentTimelineBounds(cfg, physicianId);
    }
    return (
        boundsFromSegments(day.segments ?? [], deriveAppointmentTimelineBounds(cfg, physicianId))
        ?? deriveAppointmentTimelineBounds(cfg, physicianId)
    );
}

/** Week grid: tallest day in the visible week sets the shared timeline height. */
export function deriveWeekTimelineBounds(
    cfg: PracticeWorkHoursConfig,
    isoDates: string[],
    physicianId?: string | null,
): AppointmentTimelineBounds {
    if (isoDates.length === 0) return deriveAppointmentTimelineBounds(cfg, physicianId);
    let startMin = Number.POSITIVE_INFINITY;
    let endMin = 0;
    for (const iso of isoDates) {
        const b = deriveDayTimelineBounds(cfg, iso, physicianId);
        startMin = Math.min(startMin, b.startMin);
        endMin = Math.max(endMin, b.endMin);
    }
    if (!Number.isFinite(startMin) || endMin <= startMin) {
        return deriveAppointmentTimelineBounds(cfg, physicianId);
    }
    return { startMin, endMin };
}

/**
 * Non-working bands within the timeline (before/after hours, gaps, lunch, closures).
 * Used to render light-gray regions in day/week columns.
 */
export function deriveDayClosedSpans(
    cfg: PracticeWorkHoursConfig,
    isoDate: string,
    bounds: AppointmentTimelineBounds,
): AppointmentClosedSpan[] {
    const { startMin: t0, endMin: t1 } = bounds;
    if (t1 <= t0) return [];

    if (cfg.closures.some((c) => c.date === isoDate && c.mode === "FULL_DAY")) {
        return [{ fromMin: t0, toMin: t1 }];
    }

    const day = cfg.plan[dayKeyFromIsoDate(isoDate)];
    if (!day?.active) {
        return [{ fromMin: t0, toMin: t1 }];
    }

    const open: Array<{ from: number; to: number }> = [];
    for (const seg of day.segments ?? []) {
        if (!seg.from || !seg.to || seg.from >= seg.to) continue;
        const from = timeToMinutes(seg.from);
        const to = timeToMinutes(seg.to);
        if (to <= t0 || from >= t1) continue;
        open.push({ from: Math.max(from, t0), to: Math.min(to, t1) });
    }
    open.sort((a, b) => a.from - b.from);

    const mergedOpen: Array<{ from: number; to: number }> = [];
    for (const o of open) {
        const last = mergedOpen[mergedOpen.length - 1];
        if (last && o.from <= last.to) last.to = Math.max(last.to, o.to);
        else mergedOpen.push({ ...o });
    }

    const closed: AppointmentClosedSpan[] = [];
    if (mergedOpen.length === 0) {
        closed.push({ fromMin: t0, toMin: t1 });
    } else {
        let cursor = t0;
        for (const o of mergedOpen) {
            if (o.from > cursor) closed.push({ fromMin: cursor, toMin: o.from });
            cursor = Math.max(cursor, o.to);
        }
        if (cursor < t1) closed.push({ fromMin: cursor, toMin: t1 });
    }

    if (cfg.breakFrom && cfg.breakUntil && cfg.breakFrom < cfg.breakUntil) {
        const pv = timeToMinutes(cfg.breakFrom);
        const pb = timeToMinutes(cfg.breakUntil);
        const overlapsOpen = mergedOpen.some((o) => pv < o.to && pb > o.from);
        if (overlapsOpen && pb > t0 && pv < t1) {
            closed.push({ fromMin: Math.max(t0, pv), toMin: Math.min(t1, pb) });
        }
    }

    for (const rule of cfg.closures) {
        if (rule.date !== isoDate || rule.mode !== "CUSTOM") continue;
        for (const p of rule.periods ?? []) {
            if (!p.from || !p.to || p.from >= p.to) continue;
            closed.push({
                fromMin: Math.max(t0, timeToMinutes(p.from)),
                toMin: Math.min(t1, timeToMinutes(p.to)),
            });
        }
    }

    return mergeClosedSpans(closed);
}

export function appointmentTimelineHourLabels(bounds: AppointmentTimelineBounds): number[] {
    const hours: number[] = [];
    for (let m = bounds.startMin; m < bounds.endMin; m += 60) {
        hours.push(Math.floor(m / 60));
    }
    return hours;
}
