import { create } from "zustand";
import { t } from "@/lib/i18n";
import { codeForMessage } from "@/lib/errors";

/** Window event the app shell listens to for opening the help center at a tab / code. */
export const OPEN_HELP_EVENT = "medoc-open-help";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    /** Auto-dismiss duration (ms). */
    durationMs: number;
    onUndo?: () => void;
    undoLabel?: string;
    /** Support code (`MD-…`) for error toasts — links to Help → Error codes. */
    code?: string;
}

const DURATION: Record<ToastType, number> = {
    success: 3000,
    error: 6000,
    info: 4000,
    warning: 5000,
};

interface ToastState {
    toasts: Toast[];
    /** True while pointer is inside the toast stack region — pauses all dismiss timers (WCAG 2.2.1). */
    toastStackPointerInside: boolean;
    setToastStackPointerInside: (version: boolean) => void;
    add: (
        message: string,
        type?: ToastType,
        options?: { onUndo?: () => void | Promise<void>; undoLabel?: string; durationMs?: number; code?: string },
    ) => void;
    remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    toastStackPointerInside: false,
    setToastStackPointerInside: (version) => set({ toastStackPointerInside: version }),
    add: (message, type = "success", options) => {
        const id = crypto.randomUUID();
        const durationMs = options?.durationMs ?? DURATION[type];
        const toast: Toast = {
            id,
            message,
            type,
            durationMs,
            onUndo: options?.onUndo,
            undoLabel: options?.undoLabel ?? t("common.undo"),
            // Error toasts get their support code automatically when the message came from the resolver.
            code: options?.code ?? (type === "error" ? codeForMessage(message) : undefined),
        };
        set((s) => ({
            toasts: [...s.toasts.filter((x) => !(x.message === message && x.type === type)), toast].slice(-5),
        }));
    },
    remove: (id) => {
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    },
}));
