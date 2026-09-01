/**
 * Accent colors (CSS variables on :root). Kept in sync with appearance settings.
 */

export type AccentId = "mint" | "ocean" | "plum" | "amber" | "rose";

export const ACCENT_LABELS: Record<AccentId, string> = {
    mint: "Mint",
    ocean: "Ocean",
    plum: "Plum",
    amber: "Amber",
    rose: "Rose",
};

/** Order in color picker (appearance). */
export const ACCENT_ORDER: readonly AccentId[] = ["mint", "ocean", "plum", "amber", "rose"];

const ACCENT_ID_SET = new Set<string>(ACCENT_ORDER as readonly string[]);

/** Short description under name — UI only. */
export const ACCENT_HINTS: Record<AccentId, string> = {
    mint: "Calm, clinical",
    ocean: "Classic blue",
    plum: "High contrast",
    amber: "Warm, attention",
    rose: "Friendly, clear",
};

/** Legacy keys — migration in {@link loadClientSettings}. */
export const LEGACY_ACCENT_STORAGE_KEY = "medoc-accent-preset";

const PRESETS: Record<AccentId, { accent: string; soft: string; ink: string }> = {
    mint: { accent: "#0EA07E", soft: "#DCF3EC", ink: "#06604B" },
    ocean: { accent: "#0A84FF", soft: "#E5F1FF", ink: "#0355B7" },
    plum: { accent: "#AF52DE", soft: "#F2E4FB", ink: "#6B2A95" },
    amber: { accent: "#D97706", soft: "#FEF3C7", ink: "#92400E" },
    rose: { accent: "#E11D48", soft: "#FFE4E9", ink: "#9F1239" },
};

export function isAccentIdString(raw: unknown): raw is AccentId {
    return typeof raw === "string" && ACCENT_ID_SET.has(raw);
}

export function normalizeAccentId(raw: unknown): AccentId {
    const s = typeof raw === "string" ? raw : "";
    return ACCENT_ID_SET.has(s) ? (s as AccentId) : "mint";
}

export function applyAccentPresetToDocument(id: AccentId, theme: "light" | "dark" = "light"): void {
    const version = PRESETS[normalizeAccentId(id)];
    document.documentElement.style.setProperty("--accent", version.accent);
    if (theme === "dark") {
        document.documentElement.style.setProperty("--accent-soft", `color-mix(in oklab, ${version.accent} 28%, #12161d)`);
        document.documentElement.style.setProperty("--accent-ink", `color-mix(in oklab, #f4f4f5 88%, ${version.accent})`);
    } else {
        document.documentElement.style.setProperty("--accent-soft", version.soft);
        document.documentElement.style.setProperty("--accent-ink", version.ink);
    }
}

export function readLegacyAccentFromStorage(): AccentId | null {
    try {
        const raw = localStorage.getItem(LEGACY_ACCENT_STORAGE_KEY);
        if (raw && ACCENT_ID_SET.has(raw)) return raw as AccentId;
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
