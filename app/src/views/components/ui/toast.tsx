import { useT } from "@/lib/i18n";
import type { Toast } from "./toast-store";
import { useToastStore } from "./toast-store";

const typeStyles: Record<Toast["type"], string> = {
    success: "bg-success-container text-success border-success/20",
    error: "bg-error-container text-error border-error/20",
    info: "bg-info-container text-primary border-primary/20",
};

export function ToastContainer() {
    const toasts = useToastStore((s) => s.toasts);
    const remove = useToastStore((s) => s.remove);
    const t = useT();

    if (toasts.length === 0) return null;

    return (
        <div
            className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm"
            role="region"
            aria-label={t("a11y.notifications_region")}
            aria-live="polite"
            aria-relevant="additions text"
        >
            {toasts.map((tToast) => (
                <div
                    key={tToast.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-body-medium animate-slide-up ${typeStyles[tToast.type]}`}
                >
                    <span className="flex-1">{tToast.message}</span>
                    <button
                        type="button"
                        onClick={() => remove(tToast.id)}
                        aria-label={t("a11y.dismiss_notification")}
                        className="opacity-60 hover:opacity-100 transition-opacity focus-ring rounded px-1"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}
