import type { ReactNode } from "react";

/** Centered card layout for pre-login onboarding routes (matches db-setup gate). */
export function OnboardingShell({ children }: { children: ReactNode }) {
    return (
        <div className="onboarding-page">
            <div className="onboarding-card">{children}</div>
        </div>
    );
}
