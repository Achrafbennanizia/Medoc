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
    verbundGetStatus,
} from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";
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
    const session = useAuthStore((s) => s.session);
    const setStatus = useVerbundStore((s) => s.setStatus);
    const loadError = useVerbundStore((s) => s.loadError);
    const setLoadError = useVerbundStore((s) => s.setLoadError);
    const [phase, setPhase] = useState<OnboardingPhase | null>(null);

    const refresh = useCallback(() => {
        setLoadError(null);
        void verbundGetStatus()
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

    if (status === null || phase === null) {
        return (
            <div className="onboarding-page" role="status">
                <p className="card-sub">{t("onboarding.gate.loading")}</p>
            </div>
        );
    }

    const path = location.pathname;
    const onOnboarding = path.startsWith("/onboarding");
    const onLizenz = path === "/onboarding" || path === "/onboarding/lizenz";
    const onBeitreten = path === "/onboarding/beitreten";
    const onAbonnement = path === "/onboarding/abonnement";
    const onKonto = path === "/onboarding/konto";
    const onLogin = path === "/login";

    const { needsDeviceSetup, needsPracticeSetup, needsMemberAccount } = phase;
    const onboardingComplete = !needsDeviceSetup && !needsPracticeSetup && !needsMemberAccount;

    if (needsDeviceSetup && !onOnboarding) {
        return <Navigate to="/onboarding/lizenz" replace />;
    }
    if (needsDeviceSetup && onOnboarding && !onLizenz && !onBeitreten) {
        return <Navigate to="/onboarding/lizenz" replace />;
    }

    if (needsPracticeSetup && !onAbonnement) {
        return <Navigate to="/onboarding/abonnement" replace />;
    }

    if (needsMemberAccount && !session && !onKonto && !onLogin) {
        return <Navigate to="/onboarding/konto" replace />;
    }

    if (onboardingComplete && onOnboarding) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
