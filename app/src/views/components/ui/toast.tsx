import { useT } from "@/lib/i18n";
import { useToastStore, type Toast as ToastItem } from "./toast-store";
import { CheckIcon, XIcon } from "@/lib/icons";

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
    const t = useT();
    const isError = toast.type === "error";
    const live = isError ? "assertive" : "polite";
    const role = isError ? "alert" : "status";

    const handleUndo = () => {
        toast.onUndo?.();
        onDismiss();
    };

    return (
        <div
            className={`toast-item ${toast.type} animate-slide-up`}
            role={role}
            aria-live={live}
            style={{ ["--toast-dur" as string]: `${toast.durationMs}ms` }}
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
                    onClick={onDismiss}
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
                <ToastRow key={toast.id} toast={toast} onDismiss={() => remove(toast.id)} />
            ))}
        </div>
    );
}
