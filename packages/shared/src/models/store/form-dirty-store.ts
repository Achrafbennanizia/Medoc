import { create } from "zustand";

/** Lightweight global „ungespeicherte Änderungen“ flag for beforeunload (NFA-USE-03). */
interface FormDirtyState {
    dirty: boolean;
    setDirty: (v: boolean) => void;
}

export const useFormDirtyStore = create<FormDirtyState>((set) => ({
    dirty: false,
    setDirty: (dirty) => set({ dirty }),
}));
