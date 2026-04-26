import { create } from "zustand";
import {
    DEFAULT_CONFIRMATION_PREFS,
    loadConfirmationPrefsFromKv,
    persistConfirmationPrefsToKv,
    type AreaOverride,
    type ConfirmationAreaKey,
    type ConfirmationPrefs,
    type ConfirmationPresentMode,
} from "@/lib/confirmation-preferences";

type UiPreferencesState = {
    confirmations: ConfirmationPrefs;
    hydrated: boolean;
    hydrate: () => Promise<void>;
    setDefaultConfirmationMode: (mode: ConfirmationPresentMode) => Promise<void>;
    setAreaConfirmationOverride: (area: ConfirmationAreaKey, value: AreaOverride) => Promise<void>;
};

export const useUiPreferencesStore = create<UiPreferencesState>((set, get) => ({
    confirmations: { ...DEFAULT_CONFIRMATION_PREFS },
    hydrated: false,

    hydrate: async () => {
        const prefs = await loadConfirmationPrefsFromKv();
        set({ confirmations: prefs, hydrated: true });
    },

    setDefaultConfirmationMode: async (mode) => {
        const cur = get().confirmations;
        const next: ConfirmationPrefs = { ...cur, defaultMode: mode };
        set({ confirmations: next });
        await persistConfirmationPrefsToKv(next);
    },

    setAreaConfirmationOverride: async (area, value) => {
        const cur = get().confirmations;
        const areas = { ...cur.areas, [area]: value };
        const next: ConfirmationPrefs = { ...cur, areas };
        set({ confirmations: next });
        await persistConfirmationPrefsToKv(next);
    },
}));
