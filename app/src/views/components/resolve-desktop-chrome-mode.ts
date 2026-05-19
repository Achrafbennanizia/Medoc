import { isTauriApp } from "@/lib/save-download";

export type DesktopChromeMode = "browser" | "frameless" | "mac-overlay";

/** Tauri desktop: macOS with native traffic lights uses overlay chrome; other OS frameless custom titlebar. */
export function resolveDesktopChromeMode(): DesktopChromeMode {
    if (!isTauriApp()) return "browser";
    if (typeof navigator === "undefined") return "frameless";
    const ua = navigator.userAgent ?? "";
    const platform = navigator.platform ?? "";
    const mac = /Mac|iPhone|iPod|iPad/i.test(platform) || /Mac OS X/i.test(ua);
    return mac ? "mac-overlay" : "frameless";
}
