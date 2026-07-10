import { create } from "zustand";
import {
    loadPraxisArbeitszeitenConfig,
    readPraxisArbeitszeitenConfig,
    type PraxisArbeitszeitenConfig,
} from "@/lib/praxis-planning";
import { PRAXIS_ARBEITSZEITEN_CHANGED_EVENT } from "@/lib/termin-calendar-layout";

type PraxisArbeitszeitenState = {
    config: PraxisArbeitszeitenConfig;
    hydrated: boolean;
    lastFetchedAt: number | null;
    setConfig: (cfg: PraxisArbeitszeitenConfig) => void;
    hydrate: () => Promise<PraxisArbeitszeitenConfig>;
    refresh: () => Promise<PraxisArbeitszeitenConfig>;
};

function configsEqual(a: PraxisArbeitszeitenConfig, b: PraxisArbeitszeitenConfig): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

export const usePraxisArbeitszeitenStore = create<PraxisArbeitszeitenState>((set, get) => ({
    config: readPraxisArbeitszeitenConfig(),
    hydrated: false,
    lastFetchedAt: null,
    setConfig: (cfg) => set({ config: cfg, lastFetchedAt: Date.now() }),
    hydrate: async () => {
        const cfg = await loadPraxisArbeitszeitenConfig();
        set({ config: cfg, hydrated: true, lastFetchedAt: Date.now() });
        return cfg;
    },
    refresh: async () => {
        const cfg = await loadPraxisArbeitszeitenConfig();
        const prev = get().config;
        if (!configsEqual(prev, cfg)) {
            set({ config: cfg, lastFetchedAt: Date.now() });
        }
        return cfg;
    },
}));

/** Subscribe to local saves and remote KV refreshes. */
export function bindPraxisArbeitszeitenStoreEvents(): () => void {
    const onChanged = (event: Event) => {
        const detail = (event as CustomEvent<PraxisArbeitszeitenConfig>).detail;
        if (detail && typeof detail === "object") {
            usePraxisArbeitszeitenStore.getState().setConfig(detail);
            return;
        }
        void usePraxisArbeitszeitenStore.getState().refresh();
    };
    window.addEventListener(PRAXIS_ARBEITSZEITEN_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PRAXIS_ARBEITSZEITEN_CHANGED_EVENT, onChanged);
}
