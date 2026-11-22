/** Predefined medications as a list/detail data source over the practice catalogue (medication-catalog.ts). */
import { loadMedicationCatalog, saveMedicationCatalog, type MedicationPreset } from "@/lib/medication-catalog";
import type { CrudAdapter } from "../master-detail/use-master-detail-crud";

export type MedicationForm = Omit<MedicationPreset, "id">;

const clean = (f: MedicationForm): MedicationForm => ({ ...f, label: f.label.trim(), active_ingredient: f.active_ingredient.trim(), dosage: f.dosage.trim(), duration: f.duration.trim(), instructions: f.instructions.trim() });

/** Each change reloads the stored list first, so edits made on another device are not overwritten. */
export const medicationPresetsAdapter: CrudAdapter<MedicationPreset, MedicationForm> = {
    list: async () => [...(await loadMedicationCatalog())].sort((a, b) => a.label.localeCompare(b.label)),
    create: async (form) => {
        const item = { ...clean(form), id: crypto.randomUUID() };
        await saveMedicationCatalog([...(await loadMedicationCatalog()), item]);
        return item;
    },
    update: async (item, form) => {
        const next = { ...clean(form), id: item.id };
        await saveMedicationCatalog((await loadMedicationCatalog()).map((m) => (m.id === item.id ? next : m)));
        return next;
    },
    remove: async (item) => {
        await saveMedicationCatalog((await loadMedicationCatalog()).filter((m) => m.id !== item.id));
    },
};
