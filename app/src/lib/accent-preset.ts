/**
 * Akzentfarben (CSS-Variablen auf :root). Wird mit Darstellungseinstellungen synchron gehalten.
 */

export type AccentId = "mint" | "ocean" | "plum";

export const ACCENT_LABELS: Record<AccentId, string> = {
    mint: "Mint",
    ocean: "Ocean",
    plum: "Plum",
};

/** Legacy-Schlüssel — Migration in {@link loadClientSettings}. */
export const LEGACY_ACCENT_STORAGE_KEY = "medoc-accent-preset";

const PRESETS: Record<AccentId, { accent: string; soft: string; ink: string }> = {
    mint: { accent: "#0EA07E", soft: "#DCF3EC", ink: "#06604B" },
    ocean: { accent: "#0A84FF", soft: "#E5F1FF", ink: "#0355B7" },
    plum: { accent: "#AF52DE", soft: "#F2E4FB", ink: "#6B2A95" },
};

export function normalizeAccentId(raw: unknown): AccentId {
    return raw === "ocean" || raw === "plum" || raw === "mint" ? raw : "mint";
}

export function applyAccentPresetToDocument(id: AccentId): void {
    const v = PRESETS[normalizeAccentId(id)];
    document.documentElement.style.setProperty("--accent", v.accent);
    document.documentElement.style.setProperty("--accent-soft", v.soft);
    document.documentElement.style.setProperty("--accent-ink", v.ink);
}

export function readLegacyAccentFromStorage(): AccentId | null {
    try {
        const raw = localStorage.getItem(LEGACY_ACCENT_STORAGE_KEY);
        if (raw === "ocean" || raw === "plum" || raw === "mint") return raw;
    } catch {
        /* ignore */
    }
    return null;
}

export function mirrorAccentToLegacyStorage(id: AccentId): void {
    try {
        localStorage.setItem(LEGACY_ACCENT_STORAGE_KEY, normalizeAccentId(id));
    } catch {
        /* ignore */
    }
}

export function accentColorCircle(id: AccentId): string {
    return PRESETS[normalizeAccentId(id)].accent;
}
