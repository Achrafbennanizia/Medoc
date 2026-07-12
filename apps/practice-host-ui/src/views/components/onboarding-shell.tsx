import type { ReactNode } from "react";

type OnboardingShellProps = {
    children: ReactNode;
    /** Wider card for multi-section forms (subscription, etc.). */
    wide?: boolean;
    /** Fit viewport height with a scrollable body (long forms). */
    scrollable?: boolean;
};

/** Centered card layout for pre-login onboarding routes (matches db-setup gate). */
export function OnboardingShell({ children, wide = false, scrollable = false }: OnboardingShellProps) {
    const cardClass = [
        "onboarding-card",
        wide ? "onboarding-card--wide" : "",
        scrollable ? "onboarding-card--scrollable" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className={scrollable ? "onboarding-page onboarding-page--scroll" : "onboarding-page"}>
            <div className={cardClass}>{children}</div>
        </div>
    );
}
