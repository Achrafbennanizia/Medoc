import { useCallback, useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { useToastStore, type Toast as ToastItem } from "./toast-store";
import { CheckIcon, XIcon } from "@/lib/icons";

function ToastRow({ toast, remove }: { toast: ToastItem; remove: (id: string) => void }) {
    const t = useT();
    const isError = toast.type === "error";
    const live = isError ? "assertive" : "polite";
    const role = isError ? "alert" : "status";

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const remainingRef = useRef(toast.durationMs);
    const endAtRef = useRef(0);
    const pausedRef = useRef(false);

    const armTimer = useCallback(() => {
        clearTimeout(timeoutRef.current);
        const delay = remainingRef.current;
        endAtRef.current = Date.now() + delay;
        timeoutRef.current = setTimeout(() => {
            remove(toast.id);
        }, delay + 400);
    }, [remove, toast.id]);

    useEffect(() => {
        remainingRef.current = toast.durationMs;
        pausedRef.current = false;
        armTimer();
        return () => clearTimeout(timeoutRef.current);
    }, [toast.durationMs, armTimer]);

    const handleUndo = () => {
        toast.onUndo?.();
        remove(toast.id);
    };

    const onPointerEnter = () => {
        if (pausedRef.current) return;
        pausedRef.current = true;
        clearTimeout(timeoutRef.current);
        remainingRef.current = Math.max(0, endAtRef.current - Date.now());
    };

    const onPointerLeave = () => {
        if (!pausedRef.current) return;
        pausedRef.current = false;
        armTimer();
    };

    return (
        <div
            className={`toast-item ${toast.type} animate-slide-up`}
            role={role}
            aria-live={live}
            tabIndex={0}
            style={{ ["--toast-dur" as string]: `${toast.durationMs}ms` }}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
        >
            <div className="toast-item-inner">
                {toast.type === "success" && <CheckIcon aria-hidden />}
                {toast.type === "error" && <XIcon aria-hidden />}
                {toast.type === "info" && <span className="toast-info-dot" aria-hidden />}
                <span className="toast-message">{toast.message}</span>
                {toast.onUndo ? (
                    <button type="button" className="toast-undo" onClick={handleUndo}>
                        {toast.undoLabel}
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => remove(toast.id)}
                    aria-label={t("a11y.dismiss_notification")}
                    className="toast-dismiss"
                >
                    ×
                </button>
            </div>
            <div className="toast-progress-track" aria-hidden>
                <div className="toast-progress-bar" />
            </div>
        </div>
    );
}

export function ToastContainer() {
    const toasts = useToastStore((s) => s.toasts);
    const remove = useToastStore((s) => s.remove);
    const t = useT();

    if (toasts.length === 0) return null;

    return (
        <div
            className="toast-stack"
            role="region"
            aria-label={t("a11y.notifications_region")}
            aria-live="polite"
        >
            {toasts.map((toast) => (
                <ToastRow key={toast.id} toast={toast} remove={remove} />
            ))}
        </div>
    );
}
