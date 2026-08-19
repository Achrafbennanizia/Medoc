/**
 * Appointment buffer / reminder / no-show — authoritative copy in SQLite `app_kv`
 * under {@link PRACTICE_APPOINTMENT_PREFERENCES_KV_KEY} (migrated from legacy `practice.preferences.v1`
 * field `appointmentPlanning` and from removed browser cache).
 */

import {
    getAppKv,
    setAppKv,
    type AppKvKey,
} from "@/systems/practice-host/controllers/app-kv.controller";
import {
    parsePracticePreferencesV1,
    PRACTICE_PREFERENCES_KV_KEY,
} from "@/lib/confirmation-preferences";

export const PRACTICE_APPOINTMENT_PREFERENCES_KV_KEY =
    "practice.preferences-appointment.v1" as const satisfies AppKvKey;

/** @deprecated Legacy `localStorage` key — cleared on migration. */
export const PRACTICE_PREFERENCES_LS_KEY = "medoc-practice-preferences-v1";

/** Thresholds for **Appointment** count per day in month view (color badge). */
export type MonthCalendarPatientLoadPrefs = {
    /** Up to and including: "wenig" tier. */
    fewMax: number;
    /** Up to and including: "mittel" tier (above = "hoch"). Must be &gt; {@link fewMax}. */
    mediumMax: number;
    /** Hex colors (#RRGGBB), for surface/border in calendar */
    colorFew: string;
    colorMedium: string;
    colorHigh: string;
};

export const DEFAULT_MONTH_CAL_PATIENT_LOAD: MonthCalendarPatientLoadPrefs = {
    fewMax: 3,
    mediumMax: 7,
    colorFew: "#22C55E",
    colorMedium: "#EAB308",
    colorHigh: "#EF4444",
};

/** Tier from **Appointment count** of a day (month calendar badge). */
export type MonthCalPatientLoadTier = "few" | "medium" | "high";

export function normalizeMonthCalendarPatientLoad(
    raw: Partial<MonthCalendarPatientLoadPrefs> | undefined,
): MonthCalendarPatientLoadPrefs {
    const d = DEFAULT_MONTH_CAL_PATIENT_LOAD;
    let fewMax = Number.parseInt(String(raw?.fewMax ?? ""), 10);
    let mediumMax = Number.parseInt(String(raw?.mediumMax ?? ""), 10);
    if (!Number.isFinite(fewMax) || fewMax < 0) fewMax = d.fewMax;
    if (!Number.isFinite(mediumMax) || mediumMax < 0) mediumMax = d.mediumMax;
    if (mediumMax <= fewMax) mediumMax = fewMax + 1;
    return {
        fewMax,
        mediumMax,
        colorFew: normalizeMonthCalHexColor(raw?.colorFew, d.colorFew),
        colorMedium: normalizeMonthCalHexColor(raw?.colorMedium, d.colorMedium),
        colorHigh: normalizeMonthCalHexColor(raw?.colorHigh, d.colorHigh),
    };
}

function normalizeMonthCalHexColor(raw: string | undefined, fallback: string): string {
    if (raw == null || typeof raw !== "string") return fallback;
    const t = raw.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(t)) return t;
    if (/^#[0-9A-Fa-f]{3}$/.test(t)) {
        return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
    }
    return fallback;
}

export function monthCalPatientLoadTier(
    appointmentCountForDay: number,
    s: MonthCalendarPatientLoadPrefs,
): MonthCalPatientLoadTier {
    if (appointmentCountForDay <= s.fewMax) return "few";
    if (appointmentCountForDay <= s.mediumMax) return "medium";
    return "high";
}

export function monthCalPatientLoadAccentHex(
    tier: MonthCalPatientLoadTier,
    s: MonthCalendarPatientLoadPrefs,
): string {
    return tier === "few" ? s.colorFew : tier === "medium" ? s.colorMedium : s.colorHigh;
}

export type PracticePreferences = {
    bufferMin: string;
    emergencyBuffer: string;
    reminder: string;
    noShow: string;
    monthCalendarPatientLoad: MonthCalendarPatientLoadPrefs;
    calendarDragDropEnabled: boolean;
};

export const DEFAULT_PRACTICE_PREFERENCES: PracticePreferences = {
    bufferMin: "5",
    emergencyBuffer: "8",
    reminder: "24",
    noShow: "warn",
    monthCalendarPatientLoad: { ...DEFAULT_MONTH_CAL_PATIENT_LOAD },
    calendarDragDropEnabled: true,
};

/** Stored JSON may still use leftover German field names. */
type PracticePreferencesWire = Partial<PracticePreferences> & {
    pufferMin?: string;
    notfallPuffer?: string;
    kalenderDragDropEnabled?: boolean;
};

function asWire(p: unknown): PracticePreferencesWire {
    return p != null && typeof p === "object" ? (p as PracticePreferencesWire) : {};
}

function clampNonNegativeIntString(raw: string | undefined, fallback: string): string {
    if (raw == null || raw === "") return fallback;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return String(n);
}

function firstDefined(...vals: unknown[]): unknown {
    return vals.find((v) => v != null);
}

function normalizePartial(p: unknown): PracticePreferences {
    const w = asWire(p);
    return {
        bufferMin: clampNonNegativeIntString(
            firstDefined(w.bufferMin, w.pufferMin) != null ? String(firstDefined(w.bufferMin, w.pufferMin)) : undefined,
            DEFAULT_PRACTICE_PREFERENCES.bufferMin,
        ),
        emergencyBuffer: clampNonNegativeIntString(
            firstDefined(w.emergencyBuffer, w.notfallPuffer) != null
                ? String(firstDefined(w.emergencyBuffer, w.notfallPuffer))
                : undefined,
            DEFAULT_PRACTICE_PREFERENCES.emergencyBuffer,
        ),
        reminder: w.reminder != null && String(w.reminder).trim() !== ""
            ? String(w.reminder)
            : DEFAULT_PRACTICE_PREFERENCES.reminder,
        noShow: w.noShow != null && String(w.noShow).trim() !== ""
            ? String(w.noShow)
            : DEFAULT_PRACTICE_PREFERENCES.noShow,
        monthCalendarPatientLoad: normalizeMonthCalendarPatientLoad(w.monthCalendarPatientLoad),
        calendarDragDropEnabled: firstDefined(w.calendarDragDropEnabled, w.kalenderDragDropEnabled) !== false,
    };
}

async function persistToDedicatedKey(next: PracticePreferences): Promise<void> {
    const normalized = normalizePartial(next);
    await setAppKv(PRACTICE_APPOINTMENT_PREFERENCES_KV_KEY, JSON.stringify(normalized));
}

/** Read from SQLite, migrating older sources once. */
export async function loadPracticePreferencesFromKv(): Promise<PracticePreferences> {
    try {
        const raw = await getAppKv(PRACTICE_APPOINTMENT_PREFERENCES_KV_KEY);
        if (raw?.trim()) {
            try {
                return normalizePartial(JSON.parse(raw));
            } catch {
                /* fall through */
            }
        }
    } catch {
        /* offline */
    }

    try {
        const prefsRaw = await getAppKv(PRACTICE_PREFERENCES_KV_KEY);
        const base = parsePracticePreferencesV1(prefsRaw);
        const tp = base.appointmentPlanning;
        if (
            tp &&
            (tp.bufferMin != null ||
                tp.pufferMin != null ||
                tp.emergencyBuffer != null ||
                tp.notfallPuffer != null ||
                tp.reminder != null ||
                tp.noShow != null)
        ) {
            const merged = normalizePartial(tp);
            await persistToDedicatedKey(merged);
            return merged;
        }
    } catch {
        /* offline */
    }

    if (typeof window !== "undefined" && window.localStorage) {
        try {
            const ls = window.localStorage.getItem(PRACTICE_PREFERENCES_LS_KEY);
            if (ls) {
                const merged = normalizePartial(JSON.parse(ls));
                try {
                    await persistToDedicatedKey(merged);
                    window.localStorage.removeItem(PRACTICE_PREFERENCES_LS_KEY);
                } catch {
                    return merged;
                }
                return merged;
            }
        } catch {
            /* ignore */
        }
    }

    return normalizePartial({});
}

export async function savePracticePreferences(next: PracticePreferences): Promise<void> {
    await persistToDedicatedKey(next);
}

/**
 * @deprecated Browser sync cache removed — returns defaults until {@link loadPracticePreferencesFromKv} runs.
 */
export function loadPracticePreferences(): PracticePreferences {
    return normalizePartial({});
}

/** Alias for pages that already call `hydrate…`; loads authoritative KV (with migration). */
export async function hydratePracticePreferencesFromKv(): Promise<PracticePreferences> {
    return loadPracticePreferencesFromKv();
}
