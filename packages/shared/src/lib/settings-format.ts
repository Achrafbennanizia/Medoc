/** Settings values that may be missing. Dates and money use the shared formatters. */
import { t } from "@/lib/i18n";
import { formatCurrency, formatDate, parseDisplayDate } from "./utils";

export function formatEurFromCents(cents: unknown): string {
    const n = typeof cents === "number" ? cents : Number(cents);
    if (!Number.isFinite(n)) return t("common.em_dash");
    return formatCurrency(n / 100);
}

export function formatDateShort(iso: unknown): string {
    const s = typeof iso === "string" ? iso : "";
    if (!s.trim()) return t("common.em_dash");
    const d = parseDisplayDate(s);
    if (Number.isNaN(d.getTime())) return s;
    return formatDate(s);
}

export function portalIntegrationPill(status: string | undefined): { className: string; label: string } {
    const s = (status ?? "").toLowerCase();
    if (s === "active" || s === "connected") {
        return { className: "settings-pill-green", label: t("settings.integrations.pill.connected") };
    }
    if (s === "beta") return { className: "settings-pill-blue", label: t("settings.integrations.pill.beta") };
    return { className: "settings-pill-gray", label: t("settings.integrations.pill.not_connected") };
}
