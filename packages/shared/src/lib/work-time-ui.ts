import { getISODay, parseISO } from "date-fns";
import { translateLocaleParams, useLocale } from "./i18n";
import type { WeeklyWorkRule } from "./staff-work-plan";

export type WorkTimeDaySummaryLite = {
    date: string;
    workedMinutes: number;
    pauseMinutes: number;
};

export type WorkTimeSessionLite = {
    startedAt: string;
    pauseStartedAt?: string | null;
    status: string;
    pauseMinutes?: number;
};

export function formatWorkMinutes(m: number, opts?: { compact?: boolean }): string {
    const abs = Math.max(0, Math.round(m));
    const h = Math.floor(abs / 60);
    const min = abs % 60;
    const key = opts?.compact ? "common.duration.hours_minutes_short" : "common.duration.hours_minutes";
    return translateLocaleParams(useLocale.getState().locale, key, {
        h,
        m: min,
    });
}

/** Compact axis label: "Ada West" → "Ada W." (full name stays in tooltip). */
export function formatStaffShortName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return name;
    if (parts.length === 1) return parts[0]!;
    const last = parts[parts.length - 1]!;
    const initial = last.length <= 2 && last.endsWith(".") ? last : `${last.charAt(0).toUpperCase()}.`;
    return `${parts[0]} ${initial}`;
}

export function targetMinutesForDay(
    staffId: string,
    dateYmd: string,
    weeklyRules: readonly WeeklyWorkRule[],
): number {
    const weekday = getISODay(parseISO(dateYmd)) as WeeklyWorkRule["weekday"];
    return weeklyRules
        .filter((r) => r.staffId === staffId && r.weekday === weekday)
        .reduce((sum, r) => sum + Math.max(0, r.endMin - r.startMin), 0);
}

export function liveElapsedMinutes(
    session: WorkTimeSessionLite,
    openPauseMinutes: number,
    nowMs = Date.now(),
): number {
    const start = Date.parse(session.startedAt);
    if (Number.isNaN(start)) return 0;
    const gross = Math.max(0, Math.floor((nowMs - start) / 60_000));
    const storedPause = session.pauseMinutes ?? 0;
    let openPause = openPauseMinutes;
    if (session.status === "PAUSED" && session.pauseStartedAt) {
        const ps = Date.parse(session.pauseStartedAt);
        if (!Number.isNaN(ps)) {
            openPause = Math.max(0, Math.floor((nowMs - ps) / 60_000));
        }
    }
    return Math.max(0, gross - storedPause - openPause);
}

/** Hours used as the bar scale when that weekday has no target (Soll). */
export const UNSET_DAY_SCALE_MINUTES = 8 * 60;

/**
 * Bar scale for one day. An unset target must not collapse to the worked
 * minutes, or a short day paints as a full column.
 */
export function weekBarScaleMinutes(day: Pick<WeekBarDay, "targetMinutes" | "workedMinutes" | "openMinutes">): number {
    const used = day.workedMinutes + day.openMinutes;
    if (day.targetMinutes > 0) return Math.max(day.targetMinutes, used, 1);
    return Math.max(UNSET_DAY_SCALE_MINUTES, used, 1);
}

export type WeekBarDay = {
    date: string;
    label: string;
    targetMinutes: number;
    workedMinutes: number;
    pauseMinutes: number;
    openMinutes: number;
};

export function buildWeekBarDays(
    weekDays: string[],
    dayLabels: string[],
    staffId: string,
    weeklyRules: readonly WeeklyWorkRule[],
    overviewDays: WorkTimeDaySummaryLite[],
    activeSession: WorkTimeSessionLite | null,
    openPauseMinutes: number,
    nowMs = Date.now(),
): WeekBarDay[] {
    const byDate = new Map(overviewDays.map((d) => [d.date, d]));
    return weekDays.map((date, i) => {
        const summary = byDate.get(date);
        const isActiveDay =
            activeSession != null && activeSession.startedAt.slice(0, 10) === date;
        const live = isActiveDay && activeSession
            ? liveElapsedMinutes(activeSession, openPauseMinutes, nowMs)
            : 0;
        const fromSummary = summary?.workedMinutes ?? 0;
        // The week summary already includes the open session. Taking the
        // larger of the two keeps the bar on the live clock without adding
        // that session a second time.
        const workedMinutes = isActiveDay ? Math.max(fromSummary, live) : fromSummary;
        return {
            date,
            label: dayLabels[i] ?? date,
            targetMinutes: targetMinutesForDay(staffId, date, weeklyRules),
            workedMinutes,
            pauseMinutes: summary?.pauseMinutes ?? 0,
            openMinutes: 0,
        };
    });
}
