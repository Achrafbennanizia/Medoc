/** Width of the sidebar account menu: wide enough for its longest word, never wider than the window. */
export type SidebarAccountPopoverFixed = { left: number; bottom: number; width: number };

const FALLBACK_PX = 168;
const MIN_PX = 140;
/** Popover horizontal padding + row horizontal padding. */
const CHROME_PX = 16 + 24;

export function measureSidebarAccountMenuWidthPx(labels: string[]): number {
    if (typeof document === "undefined") return FALLBACK_PX;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return FALLBACK_PX;
    ctx.font = "500 13px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    let maxWord = 0;
    for (const word of labels.flatMap((l) => l.split(/\s+/)).filter(Boolean)) maxWord = Math.max(maxWord, ctx.measureText(word).width);
    // Largest word + 2 px horizontal padding (1 px each side).
    const raw = Math.ceil(maxWord) + 2 + CHROME_PX;
    return Math.min(typeof window !== "undefined" ? window.innerWidth - 24 : raw, Math.max(MIN_PX, raw));
}
