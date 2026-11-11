/** Small format helpers for Settings / portal sections (Phase 3.7 split). */
import { t } from "@/lib/i18n";
import { practiceCurrency } from "./practice-currency";

export function formatEurFromCents(cents: unknown): string {
    const n = typeof cents === "number" ? cents : Number(cents);
    if (!Number.isFinite(n)) return t("common.em_dash");
    const currency = practiceCurrency();
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n / 100);
    } catch {
        return t("common.em_dash");
    }
}

export function formatDateShort(iso: unknown): string {
    const s = typeof iso === "string" ? iso : "";
    if (!s.trim()) return t("common.em_dash");
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("de-DE");
}

export function portalIntegrationPill(status: string | undefined): { className: string; label: string } {
    const s = (status ?? "").toLowerCase();
    if (s === "active" || s === "connected") {
        return { className: "settings-pill-green", label: t("settings.integrations.pill.connected") };
    }
    if (s === "beta") return { className: "settings-pill-blue", label: t("settings.integrations.pill.beta") };
    return { className: "settings-pill-gray", label: t("settings.integrations.pill.not_connected") };
}
