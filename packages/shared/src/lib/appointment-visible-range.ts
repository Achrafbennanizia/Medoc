import { addDays, addMonths, addWeeks, startOfWeek } from "date-fns";
import { localIsoDate } from "@/lib/utils";

export type CalendarView = "day" | "week" | "month";


function parseIsoDate(iso: string): Date {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Inclusive `yyyy-MM-dd` dates from `from` through `to`. */
export function eachIsoDate(from: string, to: string): string[] {
    const out: string[] = [];
    let cursor = parseIsoDate(from);
    const end = parseIsoDate(to);
    while (cursor.getTime() <= end.getTime()) {
        out.push(localIsoDate(cursor));
        cursor = addDays(cursor, 1);
    }
    return out;
}

/**
 * The six-week grid that contains the day, week, or month on screen.
 * One fetch covers day-to-day navigation inside that month.
 */
export function monthGridRangeForView(
    view: CalendarView,
    monthOffset: number,
    weekOffset: number,
    dayOffset: number,
    today = new Date(),
): { from: string; to: string } {
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const anchor =
        view === "week"
            ? startOfWeek(addWeeks(base, weekOffset), { weekStartsOn: 1 })
            : view === "day"
              ? addDays(base, dayOffset)
              : addMonths(base, monthOffset);
    const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: 1 });
    const gridEnd = addDays(gridStart, 6 * 7 - 1);
    return { from: localIsoDate(gridStart), to: localIsoDate(gridEnd) };
}

/** Practice year the calendar search uses. At most 427 days, under the 450-day server cap. */
export function practiceYearRange(today = new Date()): { from: string; to: string } {
    const from = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    const to = new Date(today.getFullYear(), today.getMonth() + 3, 0);
    return { from: localIsoDate(from), to: localIsoDate(to) };
}

export function rangeIsCovered(coveredDays: ReadonlySet<string>, from: string, to: string): boolean {
    return eachIsoDate(from, to).every((day) => coveredDays.has(day));
}

/**
 * Replace every row inside `[from, to]` with the rows just read from the database.
 * A sync from the main device can carry an older `updated_at` than the first
 * paint of this screen; that row is still the current database row.
 */
export function replaceAppointmentsInSpan<T extends { id: string; date: string }>(
    prev: T[],
    incoming: T[],
    from: string,
    to: string,
): T[] {
    const kept = prev.filter((row) => row.date < from || row.date > to);
    return kept.concat(incoming);
}

/**
 * Replace rows inside `[from, to]` with `incoming`.
 * A local row wins when its `updated_at` is newer than the server copy.
 */
export function mergeAppointmentsInSpan<T extends { id: string; date: string; updated_at: string }>(
    prev: T[],
    incoming: T[],
    from: string,
    to: string,
): T[] {
    const prevById = new Map(prev.map((row) => [row.id, row]));
    const incomingIds = new Set(incoming.map((row) => row.id));
    const kept = prev.filter((row) => !incomingIds.has(row.id) && (row.date < from || row.date > to));
    const merged = incoming.map((row) => {
        const local = prevById.get(row.id);
        if (local && local.updated_at > row.updated_at) return local;
        return row;
    });
    return kept.concat(merged);
}
