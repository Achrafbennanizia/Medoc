/**
 * Predefined medications: the practice's own list (Administration → Predefined medications),
 * stored practice-wide in `practice.medication-catalog.v1` and replicated to every device.
 * Until the practice saves its own list, the built-in suggestions are the catalogue.
 * Every screen that suggests medications reads from here, so edits show up everywhere.
 */
import { getAppKvRaw, setAppKvRaw } from "@/systems/practice-host/controllers/app-kv.controller";
import { createListenerSet } from "./create-listener-set";
import { BUILT_IN_MEDICATIONS } from "./medication-catalog-defaults";
import type { MedicationSuggestion } from "./medications";

export const MEDICATION_CATALOG_KEY = "practice.medication-catalog.v1";

export type MedicationPreset = {
    id: string;
    /** Name as printed, e.g. "Ibuprofen 400 mg". */
    label: string;
    active_ingredient: string;
    dosage_form: string;
    pack_size: string;
    /** Default schedule, e.g. "1-0-1". */
    dosage: string;
    /** Default duration, e.g. "5 days". */
    duration: string;
    instructions: string;
    active: boolean;
};

const listeners = createListenerSet();
let cache: MedicationPreset[] | null = null;

export function emptyMedicationPreset(): MedicationPreset {
    return { id: "", label: "", active_ingredient: "", dosage_form: "", pack_size: "", dosage: "", duration: "", instructions: "", active: true };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Stored JSON → presets; unreadable entries are dropped, missing fields get defaults. */
export function parseMedicationCatalog(raw: string | null | undefined): MedicationPreset[] | null {
    if (!raw?.trim()) return null;
    try {
        const list = JSON.parse(raw) as unknown;
        if (!Array.isArray(list)) return null;
        return list
            .filter((m): m is Record<string, unknown> => !!m && typeof m === "object" && str((m as Record<string, unknown>).label).trim() !== "")
            .map((m) => ({
                ...emptyMedicationPreset(),
                id: str(m.id) || crypto.randomUUID(),
                label: str(m.label).trim(),
                active_ingredient: str(m.active_ingredient),
                dosage_form: str(m.dosage_form),
                pack_size: str(m.pack_size),
                dosage: str(m.dosage),
                duration: str(m.duration),
                instructions: str(m.instructions),
                active: m.active !== false,
            }));
    } catch {
        return null;
    }
}

/** The built-in list as presets (what a practice starts with). */
export function defaultMedicationCatalog(): MedicationPreset[] {
    return BUILT_IN_MEDICATIONS.map((s, i) => ({
        ...emptyMedicationPreset(),
        id: `builtin-${i}`,
        label: s.label,
        active_ingredient: s.active_ingredient ?? "",
        dosage: s.dosage ?? "",
    }));
}

export async function loadMedicationCatalog(): Promise<MedicationPreset[]> {
    let raw: string | null = null;
    try {
        raw = await getAppKvRaw(MEDICATION_CATALOG_KEY);
    } catch {
        /* not signed in / offline: keep the built-in list */
    }
    cache = parseMedicationCatalog(raw) ?? defaultMedicationCatalog();
    listeners.notify();
    return cache;
}

export async function saveMedicationCatalog(list: MedicationPreset[]): Promise<MedicationPreset[]> {
    await setAppKvRaw(MEDICATION_CATALOG_KEY, JSON.stringify(list));
    cache = list;
    listeners.notify();
    return list;
}

export const subscribeMedicationCatalog = listeners.subscribe;

/** Current catalogue without waiting (built-in list until the stored one is loaded). */
export function medicationCatalogSnapshot(): MedicationPreset[] {
    return cache ?? defaultMedicationCatalog();
}

/** Active presets in the shape the prescription screens use for suggestions. */
export function medicationSuggestions(list: MedicationPreset[] = medicationCatalogSnapshot()): MedicationSuggestion[] {
    return list.filter((m) => m.active).map((m) => ({
        label: m.label,
        active_ingredient: m.active_ingredient || undefined,
        dosage: m.dosage || undefined,
        duration: m.duration || undefined,
        instructions: m.instructions || undefined,
    }));
}
