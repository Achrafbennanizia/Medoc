import { isTauriApp } from "@/lib/save-download";

/**
 * Window chrome per platform. All desktop modes share the unified top bar (brand + toolbar in the title
 * bar row); they differ only in who draws the window buttons:
 * - `mac-overlay`: native traffic lights (overlay title bar), the bar leaves room on the left.
 * - `windows`: no native frame; Fluent-style minimize / maximize / close on the right (WindowControls).
 * - `linux`: no native frame; GNOME/Adwaita-style round buttons on the right (WindowControls).
 */
export type DesktopChromeMode = "browser" | "mac-overlay" | "windows" | "linux";

/** Dev only: `localStorage["medoc.dev.chrome"] = "windows" | "linux"` previews that title bar on a Mac. */
export const DEV_CHROME_OVERRIDE_KEY = "medoc.dev.chrome";

function devChromeOverride(): DesktopChromeMode | null {
    if (!import.meta.env.DEV) return null;
    try {
        const v = localStorage.getItem(DEV_CHROME_OVERRIDE_KEY);
        return v === "windows" || v === "linux" ? v : null;
    } catch {
        return null;
    }
}

export function resolveDesktopChromeMode(): DesktopChromeMode {
    if (!isTauriApp()) return "browser";
    const forced = devChromeOverride();
    if (forced) return forced;
    if (typeof navigator === "undefined") return "windows";
    const ua = navigator.userAgent ?? "";
    const platform = navigator.platform ?? "";
    if (/Mac|iPhone|iPod|iPad/i.test(platform) || /Mac OS X/i.test(ua)) return "mac-overlay";
    if (/Win/i.test(platform) || /Windows/i.test(ua)) return "windows";
    return "linux";
}

/** Desktop modes whose window buttons are drawn by the app (no native frame). */
export function drawsOwnWindowControls(mode: DesktopChromeMode): mode is "windows" | "linux" {
    return mode === "windows" || mode === "linux";
}
