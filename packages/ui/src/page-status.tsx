import { useT } from "@/lib/i18n";
import { codeForMessage } from "@/lib/errors";
import { Spinner } from "./spinner";
import { OPEN_HELP_EVENT } from "./toast-store";

/** Inline load failure: message, support code (when known) with a link to the manual, and Retry. */
export function PageLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
    const t = useT();
    const code = codeForMessage(message);
    return (
        <div className="card card-pad page-load-error" role="alert">
            <p className="page-load-error__message">{message}</p>
            {code ? (
                <button
                    type="button"
                    className="page-load-error__code"
                    onClick={() => window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT, { detail: { tab: "errors", code } }))}
                >
                    {t("errors.code_label").replace("{code}", code)} · {t("errors.open_manual")}
                </button>
            ) : null}
            <button type="button" className="btn btn-subtle" onClick={onRetry}>
                {t("common.retry")}
            </button>
        </div>
    );
}

export function PageLoading({ label }: { label?: string }) {
    const t = useT();
    const text = label ?? t("common.loading");
    return (
        <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 20px", gap: 12, color: "var(--fg-3)" }}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <Spinner size="md" />
            <span style={{ fontSize: 13 }}>{text}</span>
        </div>
    );
}
