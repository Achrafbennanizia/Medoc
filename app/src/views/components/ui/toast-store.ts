import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    /** Auto-dismiss duration (ms). */
    durationMs: number;
    onUndo?: () => void;
    undoLabel?: string;
}

const DURATION: Record<ToastType, number> = {
    success: 3000,
    error: 6000,
    info: 4000,
};

interface ToastState {
    toasts: Toast[];
    /** True while pointer is inside the toast stack region — pauses all dismiss timers (WCAG 2.2.1). */
    toastStackPointerInside: boolean;
    setToastStackPointerInside: (v: boolean) => void;
    add: (
        message: string,
        type?: ToastType,
        options?: { onUndo?: () => void | Promise<void>; undoLabel?: string; durationMs?: number },
    ) => void;
    remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    toastStackPointerInside: false,
    setToastStackPointerInside: (v) => set({ toastStackPointerInside: v }),
    add: (message, type = "success", options) => {
        const id = crypto.randomUUID();
        const durationMs = options?.durationMs ?? DURATION[type];
        const toast: Toast = {
            id,
            message,
            type,
            durationMs,
            onUndo: options?.onUndo,
            undoLabel: options?.undoLabel ?? "Rückgängig",
        };
        set((s) => ({ toasts: [...s.toasts, toast] }));
    },
    remove: (id) => {
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    },
}));
