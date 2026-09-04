import { useLocale, useT } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { WindowChromeMaximizeIcon, WindowChromeMinimizeIcon, WindowChromeRestoreIcon, XIcon } from "@/lib/icons";
import {
    closeDesktopWindow,
    minimizeDesktopWindow,
    setDesktopWindowTitle,
    subscribeDesktopWindowMaximized,
    toggleDesktopWindowMaximize,
} from "@/lib/desktop-window-controls";
import { DesktopChromeProvider } from "./desktop-chrome";
import { resolveDesktopChromeMode } from "./resolve-desktop-chrome-mode";
import { ToastContainer } from "./ui/toast";

const WINDOW_TITLE_KEY = "app.window_title";

export function DesktopWindowFrame({ children }: { children: ReactNode }) {
    const t = useT();
    const locale = useLocale((s) => s.locale);
    const mode = useMemo(() => resolveDesktopChromeMode(), []);
    const [maximized, setMaximized] = useState(false);

    useEffect(() => {
        const title = t(WINDOW_TITLE_KEY);
        document.title = title;
        void setDesktopWindowTitle(title);
    }, [locale, t]);

    useLayoutEffect(() => {
        const root = document.documentElement;
        root.classList.remove("tauri-frameless", "tauri-macos-traffic");
        if (mode === "frameless") {
            root.classList.add("tauri-frameless");
        } else if (mode === "mac-overlay") {
            root.classList.add("tauri-macos-traffic");
        }
        return () => {
            root.classList.remove("tauri-frameless", "tauri-macos-traffic");
        };
    }, [mode]);

    useEffect(() => {
        if (mode !== "frameless") return;
        return subscribeDesktopWindowMaximized(setMaximized);
    }, [mode]);

    const onMinimize = () => {
        void minimizeDesktopWindow();
    };

    const onToggleMaximize = () => {
        void toggleDesktopWindowMaximize().then((next) => {
            if (next != null) setMaximized(next);
        });
    };

    const onClose = () => {
        void closeDesktopWindow();
    };

    if (mode === "browser") {
        return (
            <DesktopChromeProvider mode={mode}>
                {children}
                <ToastContainer />
            </DesktopChromeProvider>
        );
    }

    if (mode === "mac-overlay") {
        return (
            <DesktopChromeProvider mode={mode}>
                <div className="desktop-app-frame">
                    {/*
                      No extra drag shim: traffic lights sit in the overlay; dragging uses the React
                      top bar (`data-tauri-drag-region` + -webkit-app-region in index.css). A second
                      strip caused visible gap and double chrome height.
                    */}
                    <div className="desktop-app-frame__body">
                        <div className="desktop-app-frame__fill">{children}</div>
                    </div>
                </div>
                <ToastContainer />
            </DesktopChromeProvider>
        );
    }

    return (
        <DesktopChromeProvider mode={mode}>
            <div className="desktop-app-frame">
                <header className="desktop-titlebar desktop-titlebar--frameless-invisible">
                    <div className="desktop-titlebar__drag" data-tauri-drag-region>
                        <span className="desktop-titlebar__title sr-only">{t(WINDOW_TITLE_KEY)}</span>
                    </div>
                    <div className="desktop-titlebar__controls" role="group" aria-label={t("desktop.window_controls")}>
                        <button type="button" className="desktop-titlebar__btn" onClick={onMinimize} aria-label={t("desktop.minimize")}>
                            <WindowChromeMinimizeIcon size={11} aria-hidden />
                        </button>
                        <button
                            type="button"
                            className="desktop-titlebar__btn"
                            onClick={onToggleMaximize}
                            aria-label={maximized ? t("desktop.restore") : t("desktop.maximize")}
                        >
                            {maximized ? <WindowChromeRestoreIcon size={11} aria-hidden /> : <WindowChromeMaximizeIcon size={11} aria-hidden />}
                        </button>
                        <button type="button" className="desktop-titlebar__btn desktop-titlebar__btn--close" onClick={onClose} aria-label={t("common.close")}>
                            <XIcon size={12} aria-hidden />
                        </button>
                    </div>
                </header>
                <div className="desktop-app-frame__body">
                    <div className="desktop-app-frame__fill">{children}</div>
                </div>
            </div>
            <ToastContainer />
        </DesktopChromeProvider>
    );
}
