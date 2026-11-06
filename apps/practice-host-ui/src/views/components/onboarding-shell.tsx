import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { useMacWindowDrag } from "@/lib/mac-window-drag";
import { useDesktopChromeMode } from "./desktop-chrome";

type OnboardingShellProps = {
    children: ReactNode;
    /** Wider card for multi-section forms (subscription, etc.). */
    wide?: boolean;
    /** Fit viewport height with a scrollable body (long forms). */
    scrollable?: boolean;
};

/** Centered card layout for pre-login onboarding routes (matches db-setup gate). */
export function OnboardingShell({ children, wide = false, scrollable = false }: OnboardingShellProps) {
    const t = useT();
    const desktopChrome = useDesktopChromeMode();
    const isMacOverlay = desktopChrome === "mac-overlay";
    const handleMacWindowDrag = useMacWindowDrag(isMacOverlay);
    const cardClass = [
        "onboarding-card",
        wide ? "onboarding-card--wide" : "",
        scrollable ? "onboarding-card--scrollable" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div
            className={[
                "onboarding-page",
                scrollable ? "onboarding-page--scroll" : "",
                isMacOverlay ? "onboarding-page--mac" : "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {isMacOverlay ? (
                <header
                    className="login-window-chrome"
                    data-tauri-drag-region
                    onMouseDown={handleMacWindowDrag}
                    aria-label={t("login.window_drag_aria")}
                >
                    <span className="login-window-chrome__hint" aria-hidden>
                        {t("login.brand")}
                    </span>
                </header>
            ) : null}
            <div
                className="onboarding-page__stage"
                data-tauri-drag-region={isMacOverlay ? true : undefined}
                onMouseDown={isMacOverlay ? handleMacWindowDrag : undefined}
            >
                <div className={cardClass}>{children}</div>
            </div>
        </div>
    );
}
