import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { WindowChromeMaximizeIcon, WindowChromeMinimizeIcon, WindowChromeRestoreIcon, XIcon } from "@/lib/icons";
import {
    closeDesktopWindow,
    minimizeDesktopWindow,
    subscribeDesktopWindowMaximized,
    toggleDesktopWindowMaximize,
} from "@/lib/desktop-window-controls";

/**
 * Minimize / maximize / close for frameless windows (Windows and Linux; macOS uses native traffic lights).
 * Same order and placement as the platform: always on the right. Look per platform via
 * `.window-controls--windows` (Fluent: 46px square buttons, red close) and `.window-controls--linux`
 * (Adwaita: round buttons). Lives inside drag regions, so it is marked no-drag.
 */
export function WindowControls({ platform }: { platform: "windows" | "linux" }) {
    const t = useT();
    const [maximized, setMaximized] = useState(false);

    useEffect(() => subscribeDesktopWindowMaximized(setMaximized), []);

    const iconSize = platform === "windows" ? 10 : 12;
    return (
        <div className={`window-controls window-controls--${platform}`} role="group" aria-label={t("desktop.window_controls")} data-no-drag data-target-exempt>
            <button type="button" className="window-controls__btn" onClick={() => void minimizeDesktopWindow()} aria-label={t("desktop.minimize")}>
                <WindowChromeMinimizeIcon size={iconSize} aria-hidden />
            </button>
            <button
                type="button"
                className="window-controls__btn"
                onClick={() =>
                    void toggleDesktopWindowMaximize().then((next) => {
                        if (next != null) setMaximized(next);
                    })
                }
                aria-label={maximized ? t("desktop.restore") : t("desktop.maximize")}
            >
                {maximized ? <WindowChromeRestoreIcon size={iconSize} aria-hidden /> : <WindowChromeMaximizeIcon size={iconSize} aria-hidden />}
            </button>
            <button type="button" className="window-controls__btn window-controls__btn--close" onClick={() => void closeDesktopWindow()} aria-label={t("common.close")}>
                <XIcon size={platform === "windows" ? 11 : 12} aria-hidden />
            </button>
        </div>
    );
}
