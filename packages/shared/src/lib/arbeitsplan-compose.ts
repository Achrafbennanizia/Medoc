/**
 * Additive Arbeitsplan-Einträge (Hinzufügen + Freistellen) und Auflösung zu Soll-Intervallen pro Tag.
 */
import { eachDayOfInterval, format, getISODay, parseISO } from "date-fns";

export type ArbeitsplanComposeEntry =
    | {
        id: string;
        kind: "add_range";
        personalId: string;
        dateFrom: string;
        dateTo: string;
        /** Leer = alle Wochentage im Zeitraum */
        weekdays: Array<1 | 2 | 3 | 4 | 5 | 6 | 7>;
        startMin: number;
        endMin: number;
        label?: string;
    }
    | {
        id: string;
        kind: "cut_range";
        personalId: string;
        dateFrom: string;
        dateTo: string;
        label?: string;
    }
    | {
        id: string;
        kind: "add_day";
        personalId: string;
        date: string;
        startMin: number;
        endMin: number;
        label?: string;
    };

function isoWeekdayYmd(ymd: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
    return getISODay(parseISO(ymd.length >= 10 ? ymd.slice(0, 10) : ymd)) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

function ymd(d: Date): string {
    return format(d, "yyyy-MM-dd");
}

function mergeIntervals(iv: [number, number][]): [number, number][] {
    if (iv.length === 0) return [];
    const s = [...iv].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const out: [number, number][] = [];
    let [cs, ce] = s[0]!;
    for (let i = 1; i < s.length; i++) {
        const [a, b] = s[i]!;
        if (a <= ce) ce = Math.max(ce, b);
        else {
            out.push([cs, ce]);
            cs = a;
            ce = b;
        }
    }
    out.push([cs, ce]);
    return out;
}

/** Eine Person, ein Kalendertag: zusammengeführte Arbeitsintervalle aus add_*; cut_range leert den ganzen Tag. */
export function resolveComposeWorkIntervals(
    personalId: string,
    ymdStr: string,
    entries: ArbeitsplanComposeEntry[],
): [number, number][] {
    const mine = entries.filter((e) => e.personalId === personalId);
    const adds: [number, number][] = [];
    for (const e of mine) {
        if (e.kind === "add_day") {
            if (e.date === ymdStr && e.endMin > e.startMin) {
                adds.push([e.startMin, e.endMin]);
            }
        } else if (e.kind === "add_range") {
            if (e.endMin <= e.startMin) continue;
            let from = parseISO(e.dateFrom.slice(0, 10));
            let to = parseISO(e.dateTo.slice(0, 10));
            if (from > to) [from, to] = [to, from];
            const days = eachDayOfInterval({ start: from, end: to });
            for (const d of days) {
                const y = ymd(d);
                if (y !== ymdStr) continue;
                const wd = isoWeekdayYmd(ymdStr);
                if (e.weekdays.length > 0 && !e.weekdays.includes(wd)) continue;
                adds.push([e.startMin, e.endMin]);
            }
        }
    }
    for (const e of mine) {
        if (e.kind !== "cut_range") continue;
        let from = parseISO(e.dateFrom.slice(0, 10));
        let to = parseISO(e.dateTo.slice(0, 10));
        if (from > to) [from, to] = [to, from];
        const days = eachDayOfInterval({ start: from, end: to });
        for (const d of days) {
            if (ymd(d) === ymdStr) return [];
        }
    }
    return mergeIntervals(adds);
}

export function composeWorkMinutesForDay(
    personalId: string,
    ymdStr: string,
    entries: ArbeitsplanComposeEntry[],
): number {
    return resolveComposeWorkIntervals(personalId, ymdStr, entries).reduce((s, [a, b]) => s + (b - a), 0);
}

export function newComposeEntryId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `apce-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isWeekday(n: number): n is 1 | 2 | 3 | 4 | 5 | 6 | 7 {
    return n >= 1 && n <= 7;
}

export function parseComposeEntries(raw: unknown): ArbeitsplanComposeEntry[] {
    if (!Array.isArray(raw)) return [];
    const out: ArbeitsplanComposeEntry[] = [];
    for (const x of raw) {
        if (x == null || typeof x !== "object") continue;
        const o = x as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : "";
        const personalId = typeof o.personalId === "string" ? o.personalId : "";
        if (!id || !personalId) continue;
        const kind = o.kind;
        if (kind === "add_range") {
            const dateFrom = typeof o.dateFrom === "string" ? o.dateFrom : "";
            const dateTo = typeof o.dateTo === "string" ? o.dateTo : "";
            const startMin = typeof o.startMin === "number" ? o.startMin : NaN;
            const endMin = typeof o.endMin === "number" ? o.endMin : NaN;
            const weekdays = Array.isArray(o.weekdays)
                ? (o.weekdays as unknown[]).filter((w): w is 1 | 2 | 3 | 4 | 5 | 6 | 7 => typeof w === "number" && isWeekday(w))
                : [];
            if (!dateFrom || !dateTo || !Number.isFinite(startMin) || !Number.isFinite(endMin)) continue;
            out.push({
                id,
                kind: "add_range",
                personalId,
                dateFrom,
                dateTo,
                weekdays,
                startMin,
                endMin,
                label: typeof o.label === "string" ? o.label : undefined,
            });
        } else if (kind === "cut_range") {
            const dateFrom = typeof o.dateFrom === "string" ? o.dateFrom : "";
            const dateTo = typeof o.dateTo === "string" ? o.dateTo : "";
            if (!dateFrom || !dateTo) continue;
            out.push({
                id,
                kind: "cut_range",
                personalId,
                dateFrom,
                dateTo,
                label: typeof o.label === "string" ? o.label : undefined,
            });
        } else if (kind === "add_day") {
            const date = typeof o.date === "string" ? o.date : "";
            const startMin = typeof o.startMin === "number" ? o.startMin : NaN;
            const endMin = typeof o.endMin === "number" ? o.endMin : NaN;
            if (!date || !Number.isFinite(startMin) || !Number.isFinite(endMin)) continue;
            out.push({
                id,
                kind: "add_day",
                personalId,
                date,
                startMin,
                endMin,
                label: typeof o.label === "string" ? o.label : undefined,
            });
        }
    }
    return out;
}
