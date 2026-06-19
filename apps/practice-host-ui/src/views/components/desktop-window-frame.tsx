import { useLocale, useT } from "@/lib/i18n";
import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { WindowChromeMaximizeIcon, WindowChromeMinimizeIcon, WindowChromeRestoreIcon, XIcon } from "@/lib/icons";
import { DesktopChromeProvider } from "./desktop-chrome";
import { resolveDesktopChromeMode } from "./resolve-desktop-chrome-mode";

const WINDOW_TITLE_KEY = "app.window_title";

export function DesktopWindowFrame({ children }: { children: ReactNode }) {
    const t = useT();
    const locale = useLocale((s) => s.locale);
    const mode = useMemo(() => resolveDesktopChromeMode(), []);
    const [maximized, setMaximized] = useState(false);

    useEffect(() => {
        const title = t(WINDOW_TITLE_KEY);
        document.title = title;
        void (async () => {
            try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window");
                await getCurrentWindow().setTitle(title);
            } catch {
                /* browser / tests */
            }
        })();
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

        let unlistenResize: (() => void) | undefined;
        let cancelled = false;

        void (async () => {
            try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window");
                const w = getCurrentWindow();
                if (cancelled) return;
                setMaximized(await w.isMaximized());
                unlistenResize = await w.onResized(() => {
                    void w.isMaximized().then(setMaximized);
                });
            } catch {
                /* API unavailable (e.g. tests) */
            }
        })();

        return () => {
            cancelled = true;
            unlistenResize?.();
        };
    }, [mode]);

    const onMinimize = () => {
        void (async () => {
            try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window");
                await getCurrentWindow().minimize();
            } catch {
                /* noop */
            }
        })();
    };

    const onToggleMaximize = () => {
        void (async () => {
            try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window");
                const w = getCurrentWindow();
                await w.toggleMaximize();
                setMaximized(await w.isMaximized());
            } catch {
                /* noop */
            }
        })();
    };

    const onClose = () => {
        void (async () => {
            try {
                const { getCurrentWindow } = await import("@tauri-apps/api/window");
                await getCurrentWindow().close();
            } catch {
                /* noop */
            }
        })();
    };

    if (mode === "browser") {
        return <DesktopChromeProvider mode={mode}>{children}</DesktopChromeProvider>;
    }

    if (mode === "mac-overlay") {
        return (
            <DesktopChromeProvider mode={mode}>
                <div className="desktop-app-frame">
                    {/*
                      Kein zusätzlicher Drag-Shim: Verkehrsampeln liegen im Overlay: Ziehen passiert
                      über die React-Topbar (`data-tauri-drag-region` + -webkit-app-region in index.css).
                      Ein zweiter Streifen erzeugte sichtbaren Abstand und doppelte Chrome-Höhe.
                    */}
                    <div className="desktop-app-frame__body">
                        <div className="desktop-app-frame__fill">{children}</div>
                    </div>
                </div>
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
        </DesktopChromeProvider>
    );
}
