import { create } from "zustand";

type ReplicaSyncStatusState = {
    /** Last background or manual sync error message (replica role). */
    lastError: string | null;
    lastErrorAt: number | null;
    rePairRequired: boolean;
    setLastError: (message: string | null) => void;
    setRePairRequired: (value: boolean) => void;
    clearLastError: () => void;
};

export const useReplicaSyncStatusStore = create<ReplicaSyncStatusState>((set) => ({
    lastError: null,
    lastErrorAt: null,
    rePairRequired: false,
    setLastError: (message) =>
        set({
            lastError: message?.trim() ? message.trim() : null,
            lastErrorAt: message?.trim() ? Date.now() : null,
        }),
    setRePairRequired: (value) => set({ rePairRequired: value }),
    clearLastError: () => set({ lastError: null, lastErrorAt: null, rePairRequired: false }),
}));
