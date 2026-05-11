/**
 * Termin-Puffer / Reminder / No-Show — authoritative copy in SQLite `app_kv`
 * under {@link PRAXIS_TERMIN_PREFERENCES_KV_KEY} (migrated from legacy `praxis.preferences.v1`
 * field `terminPlanning` and from removed browser cache).
 */

import {
    getAppKv,
    setAppKv,
    type AppKvKey,
} from "@/controllers/app-kv.controller";
import {
    parsePraxisPreferencesV1,
    PRAXIS_PREFERENCES_KV_KEY,
} from "@/lib/confirmation-preferences";

export const PRAXIS_TERMIN_PREFERENCES_KV_KEY =
    "praxis.preferences-termin.v1" as const satisfies AppKvKey;

/** @deprecated Legacy `localStorage` key — cleared on migration. */
export const PRAXIS_PRAEFERENZEN_LS_KEY = "medoc-praxis-praeferenzen-v1";

/** Schwellen für die Anzahl **Termine** pro Tag in der Monatsansicht (Farb-Badge). */
export type MonthCalendarPatientLoadPrefs = {
    /** Bis einschließlich: Stufe „wenig“. */
    fewMax: number;
    /** Bis einschließlich: Stufe „mittel“ (darüber = „hoch“). Muss &gt; {@link fewMax}. */
    mediumMax: number;
    /** Hex-Farben (#RRGGBB), für Fläche/Rand im Kalender */
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

/** Stufe aus der **Terminanzahl** eines Tages (Monatskalender-Badge). */
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
    terminCountForDay: number,
    s: MonthCalendarPatientLoadPrefs,
): MonthCalPatientLoadTier {
    if (terminCountForDay <= s.fewMax) return "few";
    if (terminCountForDay <= s.mediumMax) return "medium";
    return "high";
}

export function monthCalPatientLoadAccentHex(
    tier: MonthCalPatientLoadTier,
    s: MonthCalendarPatientLoadPrefs,
): string {
    return tier === "few" ? s.colorFew : tier === "medium" ? s.colorMedium : s.colorHigh;
}

export type PraxisPraeferenzen = {
    pufferMin: string;
    notfallPuffer: string;
    reminder: string;
    noShow: string;
    monthCalendarPatientLoad: MonthCalendarPatientLoadPrefs;
};

export const DEFAULT_PRAXIS_PRAEFERENZEN: PraxisPraeferenzen = {
    pufferMin: "5",
    notfallPuffer: "8",
    reminder: "24",
    noShow: "warn",
    monthCalendarPatientLoad: { ...DEFAULT_MONTH_CAL_PATIENT_LOAD },
};

function clampNonNegativeIntString(raw: string | undefined, fallback: string): string {
    if (raw == null || raw === "") return fallback;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return String(n);
}

function normalizePartial(p: Partial<PraxisPraeferenzen> | undefined): PraxisPraeferenzen {
    const base = {
        pufferMin: clampNonNegativeIntString(
            p?.pufferMin != null ? String(p.pufferMin) : undefined,
            DEFAULT_PRAXIS_PRAEFERENZEN.pufferMin,
        ),
        notfallPuffer: clampNonNegativeIntString(
            p?.notfallPuffer != null ? String(p.notfallPuffer) : undefined,
            DEFAULT_PRAXIS_PRAEFERENZEN.notfallPuffer,
        ),
        reminder: p?.reminder != null && String(p.reminder).trim() !== ""
            ? String(p.reminder)
            : DEFAULT_PRAXIS_PRAEFERENZEN.reminder,
        noShow: p?.noShow != null && String(p.noShow).trim() !== ""
            ? String(p.noShow)
            : DEFAULT_PRAXIS_PRAEFERENZEN.noShow,
        monthCalendarPatientLoad: normalizeMonthCalendarPatientLoad(
            p?.monthCalendarPatientLoad,
        ),
    };
    return base;
}

async function persistToDedicatedKey(next: PraxisPraeferenzen): Promise<void> {
    const normalized = normalizePartial(next);
    await setAppKv(PRAXIS_TERMIN_PREFERENCES_KV_KEY, JSON.stringify(normalized));
}

/** Read from SQLite, migrating older sources once. */
export async function loadPraxisPraeferenzenFromKv(): Promise<PraxisPraeferenzen> {
    try {
        const raw = await getAppKv(PRAXIS_TERMIN_PREFERENCES_KV_KEY);
        if (raw?.trim()) {
            try {
                const j = JSON.parse(raw) as Partial<PraxisPraeferenzen>;
                return normalizePartial(j);
            } catch {
                /* fall through */
            }
        }
    } catch {
        /* offline */
    }

    try {
        const prefsRaw = await getAppKv(PRAXIS_PREFERENCES_KV_KEY);
        const base = parsePraxisPreferencesV1(prefsRaw);
        const tp = base.terminPlanning;
        if (tp && (tp.pufferMin != null || tp.notfallPuffer != null || tp.reminder != null || tp.noShow != null)) {
            const merged = normalizePartial(tp as Partial<PraxisPraeferenzen>);
            await persistToDedicatedKey(merged);
            return merged;
        }
    } catch {
        /* offline */
    }

    if (typeof window !== "undefined" && window.localStorage) {
        try {
            const ls = window.localStorage.getItem(PRAXIS_PRAEFERENZEN_LS_KEY);
            if (ls) {
                const j = JSON.parse(ls) as Partial<PraxisPraeferenzen>;
                const merged = normalizePartial(j);
                try {
                    await persistToDedicatedKey(merged);
                    window.localStorage.removeItem(PRAXIS_PRAEFERENZEN_LS_KEY);
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

export async function savePraxisPraeferenzen(next: PraxisPraeferenzen): Promise<void> {
    await persistToDedicatedKey(next);
}

/**
 * @deprecated Browser sync cache removed — returns defaults until {@link loadPraxisPraeferenzenFromKv} runs.
 */
export function loadPraxisPraeferenzen(): PraxisPraeferenzen {
    return normalizePartial({});
}

/** Alias for pages that already call `hydrate…`; loads authoritative KV (with migration). */
export async function hydratePraxisPraeferenzenFromKv(): Promise<PraxisPraeferenzen> {
    return loadPraxisPraeferenzenFromKv();
}
