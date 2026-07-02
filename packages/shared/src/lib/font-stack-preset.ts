/**
 * UI font stacks — persisted in `appearance.fontStack`, applied via `html[data-font-stack]`.
 * Inter · System · Source Sans 3
 */

export type FontStackId = "inter" | "system" | "source-sans";

export const FONT_STACK_ORDER: FontStackId[] = ["inter", "system", "source-sans"];

export const FONT_STACK_LABELS: Record<FontStackId, string> = {
    inter: "Inter",
    system: "System",
    "source-sans": "Source Sans",
};

/** Kurzbeschreibung unter der Einstellung. */
export const FONT_STACK_HINTS: Record<FontStackId, string> = {
    inter: "Modern & kompakt — Standard in MeDoc",
    system: "Native Schrift des Betriebssystems",
    "source-sans": "Ruhig & gut lesbar — etwas weiterer Zeilenabstand",
};

/** For preview in segment buttons (not for global `body`). */
export const FONT_STACK_PREVIEW_FAMILY: Record<FontStackId, string> = {
    inter: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    "source-sans": "'Source Sans 3', 'Segoe UI', sans-serif",
};

const LEGACY_FONT_STACK: Record<string, FontStackId> = {
    roboto: "system",
    "open-sans": "source-sans",
};

export function isFontStackId(raw: unknown): raw is FontStackId {
    return raw === "inter" || raw === "system" || raw === "source-sans";
}

export function normalizeFontStack(raw: unknown): FontStackId {
    if (isFontStackId(raw)) return raw;
    if (typeof raw === "string" && raw in LEGACY_FONT_STACK) return LEGACY_FONT_STACK[raw]!;
    return "inter";
}
