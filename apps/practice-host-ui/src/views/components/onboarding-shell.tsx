import type { ReactNode } from "react";
import { WindowDragStrip } from "./window-drag-strip";
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
    const desktopChrome = useDesktopChromeMode();
    const isMacOverlay = desktopChrome === "mac-overlay";
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
            <WindowDragStrip />
            <div className="onboarding-page__stage">
                <div className={cardClass}>{children}</div>
            </div>
        </div>
    );
}
