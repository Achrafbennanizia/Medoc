import { getISODay, parseISO } from "date-fns";
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

export function formatWorkMinutes(m: number): string {
    const abs = Math.max(0, Math.round(m));
    const h = Math.floor(abs / 60);
    const min = abs % 60;
    return `${h}h ${min}m`;
}

/** Compact axis label: "Aya Müller" → "Aya M." (full name stays in tooltip). */
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
        const openMinutes =
            isActiveDay && activeSession
                ? liveElapsedMinutes(activeSession, openPauseMinutes, nowMs)
                : 0;
        const endedWorked = summary?.workedMinutes ?? 0;
        return {
            date,
            label: dayLabels[i] ?? date,
            targetMinutes: targetMinutesForDay(staffId, date, weeklyRules),
            workedMinutes: endedWorked,
            pauseMinutes: summary?.pauseMinutes ?? 0,
            openMinutes: isActiveDay ? openMinutes : 0,
        };
    });
}
