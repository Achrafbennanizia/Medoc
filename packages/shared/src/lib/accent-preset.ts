/**
 * Accent colors (CSS variables on :root). Kept in sync with appearance settings.
 */

export type AccentId = "mint" | "ocean" | "plum" | "amber" | "rose";

/** Order in color picker (appearance). */
export const ACCENT_ORDER: readonly AccentId[] = ["mint", "ocean", "plum", "amber", "rose"];

const ACCENT_ID_SET = new Set<string>(ACCENT_ORDER as readonly string[]);

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

function hexRgb(hex: string): [number, number, number] {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function mixHex(a: string, b: string, weightA: number): string {
    const pa = hexRgb(a);
    const pb = hexRgb(b);
    const channel = (i: number) => Math.round(pa[i]! * weightA + pb[i]! * (1 - weightA));
    return `#${[channel(0), channel(1), channel(2)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Logo tile stops. Light and dark use different mixes of the same accent. */
export function accentMarkStops(id: AccentId, theme: "light" | "dark" = "light"): { from: string; to: string } {
    const accent = PRESETS[normalizeAccentId(id)].accent;
    if (theme === "dark") {
        return {
            from: mixHex(accent, "#f4f4f5", 0.78),
            to: mixHex(accent, "#12161d", 0.55),
        };
    }
    return {
        from: accent,
        to: mixHex(accent, "#ffffff", 0.72),
    };
}

export function applyAccentPresetToDocument(id: AccentId, theme: "light" | "dark" = "light"): void {
    const version = PRESETS[normalizeAccentId(id)];
    const mark = accentMarkStops(id, theme);
    document.documentElement.style.setProperty("--accent", version.accent);
    document.documentElement.style.setProperty("--accent-mark-from", mark.from);
    document.documentElement.style.setProperty("--accent-mark-to", mark.to);
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
