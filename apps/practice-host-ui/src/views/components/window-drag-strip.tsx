import { useT } from "@/lib/i18n";
import { useMacWindowDrag } from "@/lib/mac-window-drag";
import { useDesktopChromeMode } from "./desktop-chrome";

/**
 * The one and only drag handle for pre-shell screens (login, activation, onboarding).
 * Renders nothing outside the macOS overlay title bar. Content below it is never draggable.
 */
export function WindowDragStrip() {
    const t = useT();
    const isMacOverlay = useDesktopChromeMode() === "mac-overlay";
    const onMouseDown = useMacWindowDrag(isMacOverlay);
    if (!isMacOverlay) return null;
    return (
        <header className="login-window-chrome" data-tauri-drag-region onMouseDown={onMouseDown} aria-label={t("login.window_drag_aria")}>
            <span className="login-window-chrome__hint" aria-hidden>
                {t("login.brand")}
            </span>
        </header>
    );
}
