import type React from "react";
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

/**
 * Full-window screen shown before the app shell exists (setup, license, pairing, loading, errors).
 * Puts the drag strip on top and centres the content below it — content itself is never draggable.
 */
export function PreShellScreen({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={["pre-shell-screen", className].filter(Boolean).join(" ")}>
            <WindowDragStrip />
            <div className="pre-shell-screen__body">{children}</div>
        </div>
    );
}
