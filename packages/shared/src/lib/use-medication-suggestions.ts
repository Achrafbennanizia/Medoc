/** Active predefined medications for suggestion lists; loads the practice catalogue once and follows edits. */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { loadMedicationCatalog, medicationCatalogSnapshot, medicationSuggestions, subscribeMedicationCatalog } from "./medication-catalog";
import type { MedicationSuggestion } from "./medications";

let requested = false;

export function useMedicationSuggestions(): MedicationSuggestion[] {
    const list = useSyncExternalStore(subscribeMedicationCatalog, medicationCatalogSnapshot, medicationCatalogSnapshot);
    useEffect(() => {
        if (requested) return;
        requested = true;
        void loadMedicationCatalog().catch(() => {
            requested = false;
        });
    }, []);
    return useMemo(() => medicationSuggestions(list), [list]);
}
