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
    add: (message: string, type?: ToastType, options?: { onUndo?: () => void; undoLabel?: string }) => void;
    remove: (id: string) => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    add: (message, type = "success", options) => {
        const id = crypto.randomUUID();
        const durationMs = DURATION[type];
        const toast: Toast = {
            id,
            message,
            type,
            durationMs,
            onUndo: options?.onUndo,
            undoLabel: options?.undoLabel ?? "Rückgängig",
        };
        set((s) => ({ toasts: [...s.toasts, toast] }));
        const t = setTimeout(() => {
            timers.delete(id);
            set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
        }, durationMs + 400);
        timers.set(id, t);
    },
    remove: (id) => {
        const t = timers.get(id);
        if (t) clearTimeout(t);
        timers.delete(id);
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    },
}));
