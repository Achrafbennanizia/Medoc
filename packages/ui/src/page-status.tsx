import { useT } from "@/lib/i18n";
import { Spinner } from "./spinner";

export function PageLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
    const t = useT();
    return (
        <div className="card card-pad" style={{ maxWidth: 420, margin: "0 auto", textAlign: "center" }} role="alert">
            <p style={{ color: "var(--red)", marginBottom: 12, fontSize: 13.5 }}>{message}</p>
            <button className="btn btn-subtle" onClick={onRetry}>{t("common.retry")}</button>
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
