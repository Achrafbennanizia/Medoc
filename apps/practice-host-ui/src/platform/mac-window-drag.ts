import { useCallback, type MouseEvent } from "react";

const MAC_DRAG_BLOCK =
    "button, a, input, textarea, select, [contenteditable='true'], .input, .tb-chip, .topbar-actions, [role='menu'], .app-sidebar-brand-hit, .login-form, .login-form *";

/** macOS overlay title bar: WKWebView may ignore `-webkit-app-region`; `startDragging()` is the reliable path. */
export function useMacWindowDrag(enabled: boolean) {
    return useCallback(
        (e: MouseEvent<HTMLElement>) => {
            if (!enabled || e.button !== 0) return;
            const el = e.target as HTMLElement | null;
            if (!el?.closest) return;
            if (el.closest(MAC_DRAG_BLOCK)) return;
            void (async () => {
                try {
                    const { getCurrentWindow } = await import("@tauri-apps/api/window");
                    await getCurrentWindow().startDragging();
                } catch {
                    /* Dev in browser */
                }
            })();
        },
        [enabled],
    );
}
