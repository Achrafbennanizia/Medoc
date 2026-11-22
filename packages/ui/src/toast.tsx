import { useCallback, useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { OPEN_HELP_EVENT, useToastStore, type Toast as ToastItem } from "./toast-store";
import { XIcon } from "@/lib/icons";

function ToastRow({
    toast,
    remove,
    paused,
}: {
    toast: ToastItem;
    remove: (id: string) => void;
    paused: boolean;
}) {
    const t = useT();
    const isError = toast.type === "error";
    const live = isError ? "assertive" : "polite";
    const role = isError ? "alert" : "status";

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const closedRef = useRef(false);
    const remainingRef = useRef(toast.durationMs);
    const startedRef = useRef<number | null>(null);
    const onUndoRef = useRef(toast.onUndo);
    onUndoRef.current = toast.onUndo;

    const finish = useCallback(
        (runUndo: boolean) => {
            if (closedRef.current) return;
            closedRef.current = true;
            clearTimeout(timeoutRef.current);
            if (runUndo) void onUndoRef.current?.();
            remove(toast.id);
        },
        [remove, toast.id],
    );

    useEffect(() => {
        if (closedRef.current || paused) return;
        startedRef.current = Date.now();
        timeoutRef.current = setTimeout(() => finish(false), remainingRef.current);
        return () => {
            clearTimeout(timeoutRef.current);
            if (startedRef.current != null) {
                remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedRef.current));
                startedRef.current = null;
            }
        };
    }, [paused, finish]);

    return (
        <div
            className={`toast-item ${toast.type}${toast.onUndo ? " has-undo" : ""} animate-slide-up`}
            role={role}
            aria-live={live}
            tabIndex={0}
            style={{ ["--toast-dur" as string]: `${toast.durationMs}ms` }}
        >
            <div className="toast-item-inner">
                <button
                    type="button"
                    onClick={() => finish(false)}
                    aria-label={t("a11y.dismiss_notification")}
                    className="toast-dismiss"
                >
                    <span aria-hidden>
                        <XIcon size={14} />
                    </span>
                </button>
                {toast.type === "info" && <span className="toast-info-dot" aria-hidden />}
                {toast.type === "warning" && <span className="toast-warning-dot" aria-hidden />}
                <span className="toast-message">
                    {toast.message}
                    {toast.code ? (
                        <button
                            type="button"
                            className="toast-code"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT, { detail: { tab: "errors", code: toast.code } }));
                                remove(toast.id);
                            }}
                            title={t("errors.open_manual")}
                        >
                            {t("errors.code_label").replace("{code}", toast.code)} · {t("errors.open_manual")}
                        </button>
                    ) : null}
                </span>
                {toast.onUndo ? (
                    <button
                        type="button"
                        className="toast-undo"
                        aria-label={toast.undoLabel || t("common.undo")}
                        onClick={() => finish(true)}
                    >
                        {toast.undoLabel || t("common.undo")}
                    </button>
                ) : null}
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
    const paused = useToastStore((s) => s.toastStackPointerInside);
    const setStackPointerInside = useToastStore((s) => s.setToastStackPointerInside);
    const t = useT();

    if (toasts.length === 0) return null;

    return (
        <div
            className={`toast-stack${paused ? " is-paused" : ""}`}
            role="region"
            aria-label={t("a11y.notifications_region")}
            onPointerEnter={() => setStackPointerInside(true)}
            onPointerLeave={() => setStackPointerInside(false)}
            onFocus={() => setStackPointerInside(true)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setStackPointerInside(false);
            }}
        >
            {toasts.map((toast) => (
                <ToastRow key={toast.id} toast={toast} remove={remove} paused={paused} />
            ))}
        </div>
    );
}
