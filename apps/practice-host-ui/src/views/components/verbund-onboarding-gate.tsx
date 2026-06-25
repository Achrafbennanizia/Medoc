/**
 * Pre-login gate: unlicensed and unprovisioned installs see only onboarding routes.
 * Owner (admin) devices must reach `licensed`; members may pass on `provisioned` alone.
 */

import { useCallback, useEffect, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
    ONBOARDING_LICENSE_PENDING_KEY,
    verbundGetStatus,
} from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";
import { useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/views/components/ui/button";
import { OnboardingShell } from "@/views/components/onboarding-shell";

function needsVerbundOnboarding(
    status: NonNullable<ReturnType<typeof useVerbundStore.getState>["status"]>,
): boolean {
    if (status.licensed) return false;
    if (status.provisioned && !status.isOwner) return false;
    return true;
}

export function VerbundOnboardingGate({ children }: { children: ReactNode }) {
    const location = useLocation();
    const t = useT();
    const status = useVerbundStore((s) => s.status);
    const setStatus = useVerbundStore((s) => s.setStatus);
    const loadError = useVerbundStore((s) => s.loadError);
    const setLoadError = useVerbundStore((s) => s.setLoadError);
    const bypassForE2e = import.meta.env.VITE_E2E_BYPASS_ONBOARDING === "1";
    if (bypassForE2e) {
        return <>{children}</>;
    }
    const needsOnboarding = status === null ? true : needsVerbundOnboarding(status);

    const refresh = useCallback(() => {
        setLoadError(null);
        void verbundGetStatus()
            .then(setStatus)
            .catch((e: unknown) => {
                setStatus(null);
                setLoadError(errorMessage(e));
            });
    }, [setLoadError, setStatus]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    if (status === null && loadError) {
        return (
            <OnboardingShell>
                <h1>{t("onboarding.verbund.title")}</h1>
                <p className="card-sub">{t("onboarding.gate.error")}</p>
                <p className="card-sub" style={{ color: "var(--red)" }}>
                    {loadError}
                </p>
                <div className="onboarding-actions">
                    <Button type="button" onClick={refresh}>
                        {t("onboarding.gate.retry")}
                    </Button>
                </div>
            </OnboardingShell>
        );
    }

    if (status === null) {
        return (
            <div className="onboarding-page" role="status">
                <p className="card-sub">{t("onboarding.gate.loading")}</p>
            </div>
        );
    }

    const onOnboarding = location.pathname.startsWith("/onboarding");
    const pendingLicense = sessionStorage.getItem(ONBOARDING_LICENSE_PENDING_KEY) === "1";
    const ownerNeedsLicense = !!status.clusterId && !status.licensed;

    if ((pendingLicense || ownerNeedsLicense) && location.pathname !== "/onboarding/lizenz") {
        sessionStorage.removeItem(ONBOARDING_LICENSE_PENDING_KEY);
        return <Navigate to="/onboarding/lizenz" replace />;
    }
    if (needsOnboarding && !onOnboarding) {
        return <Navigate to="/onboarding" replace />;
    }
    if (!needsOnboarding && onOnboarding) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
