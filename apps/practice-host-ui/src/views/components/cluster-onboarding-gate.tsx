/**
 * Pre-login onboarding gate:
 * 1. License or join existing network
 * 2a. Owner → full practice setup
 * 2b. Member → create account or sign in to existing
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import {
    onboardingSubscriptionStatus,
    clusterGetStatus,
} from "@/systems/practice-host/controllers/cluster.controller";
import { useClusterStore } from "@/models/store/cluster-store";
import { useAuthStore } from "@/models/store/auth-store";
import { useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/views/components/ui/button";
import { OnboardingShell } from "@/views/components/onboarding-shell";

type OnboardingPhase = {
    needsDeviceSetup: boolean;
    needsPracticeSetup: boolean;
    needsMemberAccount: boolean;
};

function deviceSetupNeeded(
    status: NonNullable<ReturnType<typeof useClusterStore.getState>["status"]>,
): boolean {
    if (status.licensed) return false;
    if (status.provisioned && !status.isOwner) return false;
    return true;
}

export function ClusterOnboardingGate({ children }: { children: ReactNode }) {
    const location = useLocation();
    const t = useT();
    const status = useClusterStore((s) => s.status);
    const session = useAuthStore((s) => s.session);
    const setStatus = useClusterStore((s) => s.setStatus);
    const loadError = useClusterStore((s) => s.loadError);
    const setLoadError = useClusterStore((s) => s.setLoadError);
    const [phase, setPhase] = useState<OnboardingPhase | null>(null);

    const refresh = useCallback(() => {
        setLoadError(null);
        void clusterGetStatus()
            .then(async (s) => {
                setStatus(s);
                const sub = await onboardingSubscriptionStatus();
                setPhase({
                    needsDeviceSetup: deviceSetupNeeded(s),
                    needsPracticeSetup: sub.needsPracticeSetup,
                    needsMemberAccount: sub.needsMemberAccount,
                });
            })
            .catch((e: unknown) => {
                setStatus(null);
                setPhase(null);
                setLoadError(errorMessage(e));
            });
    }, [setLoadError, setStatus]);

    useEffect(() => {
        refresh();
    }, [refresh, status?.licensed, status?.provisioned, status?.isOwner, location.pathname]);

    if (status === null && loadError) {
        return (
            <OnboardingShell>
                <h1>{t("onboarding.cluster.title")}</h1>
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

    if (status === null || phase === null) {
        return (
            <div className="onboarding-page" role="status">
                <p className="card-sub">{t("onboarding.gate.loading")}</p>
            </div>
        );
    }

    const path = location.pathname;
    const onOnboarding = path.startsWith("/onboarding");
    const onLicense = path === "/onboarding" || path === "/onboarding/license";
    const onJoin = path === "/onboarding/join" || path === "/onboarding/beitreten";
    const onSubscription = path === "/onboarding/subscription" || path === "/onboarding/abonnement";
    const onAccount = path === "/onboarding/account" || path === "/onboarding/konto";
    const onLogin = path === "/login";

    const { needsDeviceSetup, needsPracticeSetup, needsMemberAccount } = phase;
    const onboardingComplete = !needsDeviceSetup && !needsPracticeSetup && !needsMemberAccount;

    if (needsDeviceSetup && !onOnboarding) {
        return <Navigate to="/onboarding/license" replace />;
    }
    if (needsDeviceSetup && onOnboarding && !onLicense && !onJoin) {
        return <Navigate to="/onboarding/license" replace />;
    }

    if (needsPracticeSetup && !onSubscription) {
        return <Navigate to="/onboarding/subscription" replace />;
    }

    if (needsMemberAccount && !session && !onAccount && !onLogin) {
        return <Navigate to="/onboarding/account" replace />;
    }

    if (onboardingComplete && onOnboarding) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
