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

/** How long an activity confirmation stays up so Undo can be reached. */
export const ACTIVITY_UNDO_MS = 5200;

/** Same visible message: up to 3 shows, at least 3 minutes apart, then quiet for 1 hour. */
export const TOAST_REPEAT_MAX = 3;
export const TOAST_REPEAT_GAP_MS = 3 * 60 * 1000;
export const TOAST_REPEAT_WINDOW_MS = 60 * 60 * 1000;
const TOAST_RATE_KEY = "medoc-toast-rate-v1";

export function recordToastStamp(previous: number[], now: number): { allow: boolean; next: number[] } {
    const stamps = previous
        .filter((stamp) => Number.isFinite(stamp) && stamp <= now)
        .slice(-TOAST_REPEAT_MAX);
    const last = stamps[stamps.length - 1];
    if (stamps.length >= TOAST_REPEAT_MAX && last !== undefined && now - last < TOAST_REPEAT_WINDOW_MS) {
        return { allow: false, next: stamps };
    }
    const active = last === undefined || now - last >= TOAST_REPEAT_WINDOW_MS
        ? []
        : stamps.filter((stamp) => now - stamp < TOAST_REPEAT_WINDOW_MS);
    const activeLast = active[active.length - 1];
    if (activeLast !== undefined && now - activeLast < TOAST_REPEAT_GAP_MS) {
        return { allow: false, next: active };
    }
    return { allow: true, next: [...active, now] };
}

function allowRepeatedToast(message: string, now: number): boolean {
    const key = message.trim();
    if (!key || typeof localStorage === "undefined") {
        return true;
    }
    let ledger: Record<string, number[]> = {};
    try {
        const raw = localStorage.getItem(TOAST_RATE_KEY);
        if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                for (const [entry, stamps] of Object.entries(parsed)) {
                    if (!Array.isArray(stamps)) continue;
                    const kept = stamps.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
                    const newest = kept[kept.length - 1];
                    if (newest !== undefined && now - newest < TOAST_REPEAT_WINDOW_MS) {
                        ledger[entry] = kept.slice(-TOAST_REPEAT_MAX);
                    }
                }
            }
        }
    } catch {
        ledger = {};
    }
    const decision = recordToastStamp(ledger[key] ?? [], now);
    if (!decision.allow) {
        ledger[key] = decision.next;
        try {
            localStorage.setItem(TOAST_RATE_KEY, JSON.stringify(ledger));
        } catch {
            /* ignore quota / private mode */
        }
        return false;
    }
    ledger[key] = decision.next;
    try {
        localStorage.setItem(TOAST_RATE_KEY, JSON.stringify(ledger));
    } catch {
        /* the in-memory decision already allowed this one */
    }
    return true;
}

interface ToastState {
    toasts: Toast[];
    /** True while pointer or focus is inside the toast stack — pauses dismiss timers (WCAG 2.2.1). */
    toastStackPointerInside: boolean;
    setToastStackPointerInside: (version: boolean) => void;
    add: (
        message: string,
        type?: ToastType,
        options?: {
            onUndo?: () => void | Promise<void>;
            undoLabel?: string;
            durationMs?: number;
            /** Skip the repeat limiter. Undoable activity toasts always skip it. */
            bypassRepeatLimit?: boolean;
            /** Support code (`MD-…`); error toasts get it automatically from the error journal. */
            code?: string;
        },
    ) => void;
    remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
    toasts: [],
    toastStackPointerInside: false,
    setToastStackPointerInside: (version) => set({ toastStackPointerInside: version }),
    add: (message, type = "success", options) => {
        const undoable = typeof options?.onUndo === "function";
        if (!undoable && !options?.bypassRepeatLimit && !allowRepeatedToast(message, Date.now())) {
            return;
        }
        const id = crypto.randomUUID();
        const durationMs = options?.durationMs ?? (undoable ? ACTIVITY_UNDO_MS : DURATION[type]);
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
        // Replace a visible identical (non-undoable) toast instead of stacking copies; cap the stack at 5.
        set((s) => ({
            toasts: [
                ...s.toasts.filter((x) => undoable || x.onUndo || !(x.message === message && x.type === type)),
                toast,
            ].slice(-5),
        }));
    },
    remove: (id) => {
        set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) }));
    },
}));
