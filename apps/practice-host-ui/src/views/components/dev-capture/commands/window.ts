/** Window size, zoom and title-bar style (Tauri window APIs, loaded on demand). */
import { delay } from "../dom";
import { missing, type CaptureCommandGroup } from "../types";

export const windowCommands: CaptureCommandGroup = {
    resize: async (cmd) => {
        if (!cmd.width) return missing("width");
        // Needs core:window:allow-set-size, granted only by the dev-run config override.
        const { getCurrentWindow, LogicalSize } = await import("@tauri-apps/api/window");
        await getCurrentWindow().setSize(new LogicalSize(cmd.width, cmd.height ?? 800));
        await delay(400);
        return { w: window.innerWidth, h: window.innerHeight };
    },
    /** `width` carries the zoom factor × 100 (e.g. 150). */
    zoom: async (cmd) => {
        if (!cmd.width) return missing("width");
        const { effectiveZoom, setSessionZoom } = await import("@/lib/display-preferences");
        setSessionZoom(cmd.width / 100);
        await delay(400);
        return { zoom: effectiveZoom(), sidebarRail: document.documentElement.dataset.sidebarRail ?? "full" };
    },
    nativeZoomTest: async (cmd) => {
        try {
            const { getCurrentWebview } = await import("@tauri-apps/api/webview");
            await getCurrentWebview().setZoom((cmd.width ?? 100) / 100);
            await delay(400);
            return { innerWidth: window.innerWidth };
        } catch (e) {
            return { ok: false, error: String(e) };
        }
    },
    /** Preview the Windows / Linux title bar on a Mac (resolve-desktop-chrome-mode.ts); reloads. */
    devChrome: async (cmd) => {
        const { DEV_CHROME_OVERRIDE_KEY } = await import("../../resolve-desktop-chrome-mode");
        if (cmd.value === "windows" || cmd.value === "linux") localStorage.setItem(DEV_CHROME_OVERRIDE_KEY, cmd.value);
        else localStorage.removeItem(DEV_CHROME_OVERRIDE_KEY);
        setTimeout(() => window.location.reload(), 150);
        return {};
    },
};
