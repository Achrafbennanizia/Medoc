import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";

export const PRACTICE_PREFERENCES_KV_KEY = "practice.preferences.v1" as const;

/** Destructive / security prompts in the patient file (extensible for other modules). */
export const CONFIRMATION_AREA_KEYS = [
    "patient_chart_patient_delete",
    "patient_chart_patient_edit",
    "patient_chart_prescription_delete",
    "patient_chart_prescription_edit",
    "patient_chart_certificate_delete",
    "patient_chart_treatment_delete",
    "patient_chart_examination_delete",
    "patient_chart_examination_edit",
    "patient_chart_payment_delete",
    "patient_chart_payment_edit",
] as const;

export type ConfirmationAreaKey = (typeof CONFIRMATION_AREA_KEYS)[number];

export type ConfirmationPresentMode = "modal" | "inline";

/** `inherit` follows {@link ConfirmationPrefs.defaultMode}. */
export type AreaOverride = "inherit" | ConfirmationPresentMode;

export type ConfirmationPrefs = {
    defaultMode: ConfirmationPresentMode;
    areas: Partial<Record<ConfirmationAreaKey, AreaOverride>>;
};

export const CONFIRMATION_AREA_LABELS: Record<ConfirmationAreaKey, string> = {
    patient_chart_patient_delete: "Delete patient record",
    patient_chart_patient_edit: "Edit patient (record)",
    patient_chart_prescription_delete: "Delete prescription (record)",
    patient_chart_prescription_edit: "Edit prescription (record)",
    patient_chart_certificate_delete: "Delete certificate (record)",
    patient_chart_treatment_delete: "Delete treatment (record)",
    patient_chart_examination_delete: "Delete examination (record)",
    patient_chart_examination_edit: "Edit examination (record)",
    patient_chart_payment_delete: "Delete payment (record)",
    patient_chart_payment_edit: "Edit payment (record)",
};

export const DEFAULT_CONFIRMATION_PREFS: ConfirmationPrefs = {
    /** Dialog / Popout — user-requested default for delete & critical confirms. */
    defaultMode: "modal",
    areas: {},
};

/** SQLite `app_kv` blob for key {@link PRACTICE_PREFERENCES_KV_KEY} — extended fields stay backward-compatible. */
export type PracticePreferencesV1 = {
    version: 1;
/** @deprecated Prefer {@link PRACTICE_APPOINTMENT_PREFERENCES_KV_KEY} / `practice-preferences-storage.ts`; optional migration source only. */
    appointmentPlanning?: {
        bufferMin?: string;
        emergencyBuffer?: string;
        /** @deprecated leftover German wire; still read on migrate */
        pufferMin?: string;
        /** @deprecated leftover German wire; still read on migrate */
        notfallPuffer?: string;
        reminder?: string;
        noShow?: string;
    };
    ui?: {
        confirmations?: {
            defaultMode?: ConfirmationPresentMode;
            areas?: Partial<Record<ConfirmationAreaKey, AreaOverride>>;
        };
        /** NFA-USE-10 — see `practice-search-prefs-sync.ts` / client-settings `search`. */
        search?: {
            autocompleteSuggestionsEnabled?: boolean;
        };
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

export function parsePracticePreferencesV1(raw: string | null): PracticePreferencesV1 {
    if (!raw) return { version: 1 };
    try {
        const j = JSON.parse(raw) as unknown;
        if (j && typeof j === "object" && (j as PracticePreferencesV1).version === 1) {
            return j as PracticePreferencesV1;
        }
    } catch {
        /* ignore */
    }
    return { version: 1 };
}

export function mergeStoredConfirmationPrefs(stored: PracticePreferencesV1): ConfirmationPrefs {
    const c = stored.ui?.confirmations;
    const defaultMode = c?.defaultMode === "inline" ? "inline" : "modal";
    const areas: Partial<Record<ConfirmationAreaKey, AreaOverride>> = {};
    for (const k of CONFIRMATION_AREA_KEYS) {
        const version = c?.areas?.[k];
        if (version === "modal" || version === "inline" || version === "inherit") {
            areas[k] = version;
        }
    }
    return { defaultMode, areas };
}

export function resolveConfirmationPresentation(
    prefs: ConfirmationPrefs,
    area: ConfirmationAreaKey,
): ConfirmationPresentMode {
    const o = prefs.areas[area];
    if (o === "modal" || o === "inline") return o;
    return prefs.defaultMode;
}

export async function loadConfirmationPrefsFromKv(): Promise<ConfirmationPrefs> {
    try {
        const raw = await getAppKv(PRACTICE_PREFERENCES_KV_KEY);
        return mergeStoredConfirmationPrefs(parsePracticePreferencesV1(raw));
    } catch {
        return { ...DEFAULT_CONFIRMATION_PREFS };
    }
}

export async function persistConfirmationPrefsToKv(next: ConfirmationPrefs): Promise<void> {
    const raw = await getAppKv(PRACTICE_PREFERENCES_KV_KEY);
    const base = parsePracticePreferencesV1(raw);
    const merged: PracticePreferencesV1 = {
        ...base,
        version: 1,
        ui: {
            ...base.ui,
            confirmations: {
                ...base.ui?.confirmations,
                defaultMode: next.defaultMode,
                areas: next.areas,
            },
        },
    };
    await setAppKv(PRACTICE_PREFERENCES_KV_KEY, JSON.stringify(merged));
}
