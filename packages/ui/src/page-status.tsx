import { useT } from "@/lib/i18n";
import { codeForMessage } from "@/lib/errors";
import { Skeleton } from "./skeleton";
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
            style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 20px", gap: "var(--space-3)", color: "var(--fg-3)" }}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <Spinner size="md" />
            <span style={{ fontSize: 13 }}>{text}</span>
        </div>
    );
}

/**
 * Loading placeholder shaped like a list table: a toolbar line, a header row and `rows` rows.
 * Same footprint as the table that replaces it, so nothing jumps when data arrives.
 */
export function TableSkeleton({ label, rows = 8, columns = 4 }: { label?: string; rows?: number; columns?: number }) {
    const t = useT();
    const widths = ["38%", "22%", "18%", "14%", "12%", "10%"];
    return (
        <div className="card page-skeleton" role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">{label ?? t("common.loading")}</span>
            {Array.from({ length: rows + 1 }, (_, r) => (
                <div key={r} className={r === 0 ? "page-skeleton__row page-skeleton__row--head" : "page-skeleton__row"}>
                    {Array.from({ length: columns }, (_, c) => (
                        <Skeleton key={c} className="page-skeleton__cell" style={{ width: widths[c % widths.length] }} />
                    ))}
                </div>
            ))}
        </div>
    );
}

/** Loading placeholder shaped like a patient record: header card, then a side menu and a content panel. */
export function RecordSkeleton({ label }: { label?: string }) {
    const t = useT();
    return (
        <div className="page-skeleton-record" role="status" aria-live="polite" aria-busy="true">
            <span className="sr-only">{label ?? t("common.loading")}</span>
            <div className="card page-skeleton-record__head">
                <Skeleton className="page-skeleton-record__avatar" />
                <div className="page-skeleton-record__lines">
                    <Skeleton style={{ width: "40%", height: 18 }} />
                    <Skeleton style={{ width: "25%" }} />
                    <Skeleton style={{ width: "70%" }} />
                </div>
            </div>
            <div className="page-skeleton-record__body">
                <div className="page-skeleton-record__nav">
                    {Array.from({ length: 6 }, (_, i) => (
                        <Skeleton key={i} style={{ height: 32 }} />
                    ))}
                </div>
                <div className="card page-skeleton-record__panel">
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} style={{ width: `${90 - i * 12}%` }} />
                    ))}
                </div>
            </div>
        </div>
    );
}
