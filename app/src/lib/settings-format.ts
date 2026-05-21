/** Small format helpers for Einstellungen / portal sections (Phase 3.7 split). */

export function formatEurFromCents(cents: unknown): string {
    const n = typeof cents === "number" ? cents : Number(cents);
    if (!Number.isFinite(n)) return "—";
    try {
        return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n / 100);
    } catch {
        return "—";
    }
}

export function formatDeDateShort(iso: unknown): string {
    const s = typeof iso === "string" ? iso : "";
    if (!s.trim()) return "—";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("de-DE");
}

export function portalIntegrationPill(status: string | undefined): { className: string; label: string } {
    const s = (status ?? "").toLowerCase();
    if (s === "active" || s === "connected") return { className: "settings-pill-green", label: "Verbunden" };
    if (s === "beta") return { className: "settings-pill-blue", label: "Beta" };
    return { className: "settings-pill-gray", label: "Nicht verbunden" };
}
