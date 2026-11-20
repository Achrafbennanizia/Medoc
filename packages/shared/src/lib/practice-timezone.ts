/** Practice IANA time zone (Settings → Practice). Cached in localStorage; source of truth is app_kv. */

import { localIsoDate } from "@/lib/utils";

export const PRACTICE_TIMEZONE_LS_KEY = "medoc-practice-timezone-v1";
export const PRACTICE_TIMEZONE_KV_KEY = "practice.timezone.v1";
export const PRACTICE_TIMEZONE_CHANGED_EVENT = "medoc:practice-timezone-changed";

export const DEFAULT_PRACTICE_TIMEZONE = "Europe/Berlin";

const listeners = new Set<() => void>();

/** Bumped on every local timezone mirror so async KV hydrates cannot clobber newer UI state. */
let practiceTimezoneWriteEpoch = 0;

/** Test / diagnostics: current optimistic-write generation. */
export function practiceTimezoneWriteEpochNow(): number {
    return practiceTimezoneWriteEpoch;
}

export function normalizePracticeTimezone(raw: string | undefined | null): string {
    const zone = (raw ?? "").trim();
    if (!zone) return DEFAULT_PRACTICE_TIMEZONE;
    try {
        // Throws RangeError for unknown IANA ids in modern engines.
        Intl.DateTimeFormat(undefined, { timeZone: zone }).format(new Date());
        return zone;
    } catch {
        return DEFAULT_PRACTICE_TIMEZONE;
    }
}

export function practiceTimezone(): string {
    try {
        const raw = localStorage.getItem(PRACTICE_TIMEZONE_LS_KEY);
        if (!raw?.trim()) return DEFAULT_PRACTICE_TIMEZONE;
        return normalizePracticeTimezone(raw);
    } catch {
        return DEFAULT_PRACTICE_TIMEZONE;
    }
}

export function subscribePracticeTimezone(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function publishPracticeTimezone(): void {
    for (const listener of listeners) listener();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PRACTICE_TIMEZONE_CHANGED_EVENT));
    }
}

/** Mirror zone into the local cache and notify subscribers (does not write app_kv). */
export function mirrorPracticeTimezoneLocal(zone: string): string {
    practiceTimezoneWriteEpoch += 1;
    const next = normalizePracticeTimezone(zone);
    try {
        localStorage.setItem(PRACTICE_TIMEZONE_LS_KEY, next);
    } catch {
        /* private mode */
    }
    publishPracticeTimezone();
    return next;
}

/**
 * Load practice timezone from app_kv into the local mirror.
 * Skips applying KV when a newer local mirror happened during the await (Settings race).
 */
export async function hydratePracticeTimezoneFromAppKv(
    readKv: () => Promise<string | null | undefined>,
): Promise<string> {
    const epochAtStart = practiceTimezoneWriteEpoch;
    let raw: string | null | undefined;
    try {
        raw = await readKv();
    } catch {
        return practiceTimezone();
    }
    if (practiceTimezoneWriteEpoch !== epochAtStart) {
        return practiceTimezone();
    }
    if (!raw?.trim()) return practiceTimezone();
    return mirrorPracticeTimezoneLocal(raw);
}

/** Calendar day `yyyy-MM-dd` for an instant in the practice time zone. */
export function ymdInTimeZone(date: Date, timeZone: string = practiceTimezone()): string {
    if (Number.isNaN(date.getTime())) return "";
    try {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: normalizePracticeTimezone(timeZone),
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(date);
    } catch {
        return localIsoDate(date);
    }
}

/** Practice-local "today". */
export function practiceTodayYmd(now = new Date(), timeZone: string = practiceTimezone()): string {
    return ymdInTimeZone(now, timeZone);
}
