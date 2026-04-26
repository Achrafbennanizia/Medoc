import { getAppKv, setAppKv } from "@/controllers/app-kv.controller";

export const PRAXIS_PREFERENCES_KV_KEY = "praxis.preferences.v1" as const;

/** Destructive / security prompts in the patient file (extensible for other modules). */
export const CONFIRMATION_AREA_KEYS = [
    "patient_akte_patient_delete",
    "patient_akte_patient_edit",
    "patient_akte_rezept_delete",
    "patient_akte_rezept_edit",
    "patient_akte_behandlung_delete",
    "patient_akte_untersuchung_delete",
    "patient_akte_untersuchung_edit",
    "patient_akte_zahlung_delete",
    "patient_akte_zahlung_edit",
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
    patient_akte_patient_delete: "Patientenakte löschen",
    patient_akte_patient_edit: "Patient bearbeiten (Akte)",
    patient_akte_rezept_delete: "Rezept löschen (Akte)",
    patient_akte_rezept_edit: "Rezept bearbeiten (Akte)",
    patient_akte_behandlung_delete: "Behandlung löschen (Akte)",
    patient_akte_untersuchung_delete: "Untersuchung löschen (Akte)",
    patient_akte_untersuchung_edit: "Untersuchung bearbeiten (Akte)",
    patient_akte_zahlung_delete: "Zahlung löschen (Akte)",
    patient_akte_zahlung_edit: "Zahlung bearbeiten (Akte)",
};

export const DEFAULT_CONFIRMATION_PREFS: ConfirmationPrefs = {
    /** Dialog / Popout — user-requested default for delete & critical confirms. */
    defaultMode: "modal",
    areas: {},
};

type PraxisPreferencesV1 = {
    version: 1;
    ui?: {
        confirmations?: {
            defaultMode?: ConfirmationPresentMode;
            areas?: Partial<Record<ConfirmationAreaKey, AreaOverride>>;
        };
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

export function parsePraxisPreferencesV1(raw: string | null): PraxisPreferencesV1 {
    if (!raw) return { version: 1 };
    try {
        const j = JSON.parse(raw) as unknown;
        if (j && typeof j === "object" && (j as PraxisPreferencesV1).version === 1) {
            return j as PraxisPreferencesV1;
        }
    } catch {
        /* ignore */
    }
    return { version: 1 };
}

export function mergeStoredConfirmationPrefs(stored: PraxisPreferencesV1): ConfirmationPrefs {
    const c = stored.ui?.confirmations;
    const defaultMode = c?.defaultMode === "inline" ? "inline" : "modal";
    const areas: Partial<Record<ConfirmationAreaKey, AreaOverride>> = {};
    for (const k of CONFIRMATION_AREA_KEYS) {
        const v = c?.areas?.[k];
        if (v === "modal" || v === "inline" || v === "inherit") {
            areas[k] = v;
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
        const raw = await getAppKv(PRAXIS_PREFERENCES_KV_KEY);
        return mergeStoredConfirmationPrefs(parsePraxisPreferencesV1(raw));
    } catch {
        return { ...DEFAULT_CONFIRMATION_PREFS };
    }
}

export async function persistConfirmationPrefsToKv(next: ConfirmationPrefs): Promise<void> {
    const raw = await getAppKv(PRAXIS_PREFERENCES_KV_KEY);
    const base = parsePraxisPreferencesV1(raw);
    const merged: PraxisPreferencesV1 = {
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
    await setAppKv(PRAXIS_PREFERENCES_KV_KEY, JSON.stringify(merged));
}
