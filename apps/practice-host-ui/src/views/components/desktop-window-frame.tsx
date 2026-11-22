import { useLocale, useT } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useMemo, type ReactNode } from "react";
import { setDesktopWindowTitle } from "@/lib/desktop-window-controls";
import { DesktopChromeProvider } from "./desktop-chrome";
import { drawsOwnWindowControls, resolveDesktopChromeMode } from "./resolve-desktop-chrome-mode";
import { WindowControls } from "./window-controls";
import { ToastContainer } from "./ui/toast";

const WINDOW_TITLE_KEY = "app.window_title";

export function DesktopWindowFrame({ children }: { children: ReactNode }) {
    const t = useT();
    const locale = useLocale((s) => s.locale);
    const mode = useMemo(() => resolveDesktopChromeMode(), []);

    useEffect(() => {
        const title = t(WINDOW_TITLE_KEY);
        document.title = title;
        if (mode !== "mac-overlay") {
            void setDesktopWindowTitle(title);
        }
    }, [locale, t, mode]);

    useLayoutEffect(() => {
        const root = document.documentElement;
        const classes = ["tauri-frameless", "tauri-macos-traffic", "tauri-unified", "tauri-windows", "tauri-linux"];
        root.classList.remove(...classes);
        if (mode === "mac-overlay") root.classList.add("tauri-macos-traffic", "tauri-unified");
        else if (drawsOwnWindowControls(mode)) root.classList.add("tauri-frameless", "tauri-unified", `tauri-${mode}`);
        return () => root.classList.remove(...classes);
    }, [mode]);

    if (mode === "browser") {
        return (
            <DesktopChromeProvider mode={mode}>
                {children}
                <ToastContainer />
            </DesktopChromeProvider>
        );
    }

    return (
        <DesktopChromeProvider mode={mode}>
            <div className="desktop-app-frame">
                {/*
                  macOS: native traffic lights, nothing to draw. Windows / Linux: a slim title bar with the
                  window buttons for the screens before sign-in; once the app shell is mounted its unified
                  top bar carries the buttons and this bar hides (CSS: :has(.app-shell)).
                */}
                {drawsOwnWindowControls(mode) ? (
                    <header className="desktop-titlebar desktop-titlebar--frameless-invisible">
                        <div className="desktop-titlebar__drag" data-tauri-drag-region>
                            <span className="desktop-titlebar__title sr-only">{t(WINDOW_TITLE_KEY)}</span>
                        </div>
                        <WindowControls platform={mode} />
                    </header>
                ) : null}
                <div className="desktop-app-frame__body">
                    <div className="desktop-app-frame__fill">{children}</div>
                </div>
            </div>
            <ToastContainer />
        </DesktopChromeProvider>
    );
}
