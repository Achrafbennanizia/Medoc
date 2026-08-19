import { create } from "zustand";
import {
    loadPracticeWorkHoursConfig,
    readPracticeWorkHoursConfig,
    type PracticeWorkHoursConfig,
} from "@/lib/practice-planning";
import { PRACTICE_WORK_HOURS_CHANGED_EVENT } from "@/lib/appointment-calendar-layout";

type PracticeWorkHoursState = {
    config: PracticeWorkHoursConfig;
    hydrated: boolean;
    lastFetchedAt: number | null;
    setConfig: (cfg: PracticeWorkHoursConfig) => void;
    hydrate: () => Promise<PracticeWorkHoursConfig>;
    refresh: () => Promise<PracticeWorkHoursConfig>;
};

function configsEqual(a: PracticeWorkHoursConfig, b: PracticeWorkHoursConfig): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export const usePracticeWorkHoursStore = create<PracticeWorkHoursState>((set, get) => ({
    config: readPracticeWorkHoursConfig(),
    hydrated: false,
    lastFetchedAt: null,
    setConfig: (cfg) => set({ config: cfg, lastFetchedAt: Date.now() }),
    hydrate: async () => {
        const cfg = await loadPracticeWorkHoursConfig();
        set({ config: cfg, hydrated: true, lastFetchedAt: Date.now() });
        return cfg;
    },
    refresh: async () => {
        const cfg = await loadPracticeWorkHoursConfig();
        const prev = get().config;
        if (!configsEqual(prev, cfg)) {
            set({ config: cfg, lastFetchedAt: Date.now() });
        }
        return cfg;
    },
}));

/** Subscribe to local saves and remote KV refreshes. */
export function bindPracticeWorkHoursStoreEvents(): () => void {
    const onChanged = (event: Event) => {
        const detail = (event as CustomEvent<PracticeWorkHoursConfig>).detail;
        if (detail && typeof detail === "object") {
            usePracticeWorkHoursStore.getState().setConfig(detail);
            return;
        }
        void usePracticeWorkHoursStore.getState().refresh();
    };
    window.addEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onChanged);
}
