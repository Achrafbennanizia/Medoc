import { create } from "zustand";

type ReplicaSyncStatusState = {
    /** Last background or manual sync error message (replica role). */
    lastError: string | null;
    lastErrorAt: number | null;
    setLastError: (message: string | null) => void;
    clearLastError: () => void;
};

export const useReplicaSyncStatusStore = create<ReplicaSyncStatusState>((set) => ({
    lastError: null,
    lastErrorAt: null,
    setLastError: (message) =>
        set({
            lastError: message?.trim() ? message.trim() : null,
            lastErrorAt: message?.trim() ? Date.now() : null,
        }),
    clearLastError: () => set({ lastError: null, lastErrorAt: null }),
}));
