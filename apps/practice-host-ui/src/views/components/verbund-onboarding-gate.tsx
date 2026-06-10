/**
 * Pre-login gate: unlicensed and unprovisioned installs see only onboarding routes.
 */

import { useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { verbundGetStatus } from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";

export function VerbundOnboardingGate({ children }: { children: ReactNode }) {
    const location = useLocation();
    const status = useVerbundStore((s) => s.status);
    const setStatus = useVerbundStore((s) => s.setStatus);
    const needsOnboarding =
        status === null ? true : !status.licensed && !status.provisioned;

    useEffect(() => {
        void verbundGetStatus()
            .then(setStatus)
            .catch(() => setStatus(null));
    }, [setStatus]);

    if (status === null) {
        return (
            <div className="route-fallback" role="status">
                Verbund-Status wird geladen …
            </div>
        );
    }

    const onOnboarding = location.pathname.startsWith("/onboarding");
    if (needsOnboarding && !onOnboarding) {
        return <Navigate to="/onboarding" replace />;
    }
    if (!needsOnboarding && onOnboarding) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
