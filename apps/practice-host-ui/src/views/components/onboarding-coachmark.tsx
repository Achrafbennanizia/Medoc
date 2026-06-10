import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import type { Rolle } from "@/models/types";
import {
    coverageRatio,
    loadOnboardingProgress,
    markOnboardingRouteDone,
    routePathFromLocation,
    stepForRoute,
    stepsForRole,
} from "@/lib/onboarding";
import { errorMessage } from "@/lib/utils";
import { Button } from "./ui/button";
import { DismissibleNotice } from "./ui/dismissible-notice";
import { useToastStore } from "./ui/toast-store";

export type OnboardingCoachmarkProps = {
    rolle: Rolle | undefined;
};

export function OnboardingCoachmark({ rolle }: OnboardingCoachmarkProps) {
    const toast = useToastStore((s) => s.add);
    const location = useLocation();
    const [completed, setCompleted] = useState<string[]>([]);
    const [dismissed, setDismissed] = useState(false);

    const routePath = routePathFromLocation(location.pathname);
    const step = stepForRoute(rolle, routePath);
    const steps = stepsForRole(rolle ?? undefined);
    const ratio = rolle ? coverageRatio(rolle, completed) : 1;

    useEffect(() => {
        setDismissed(false);
    }, [routePath]);

    useEffect(() => {
        if (!rolle) {
            setCompleted([]);
            return;
        }
        void loadOnboardingProgress(rolle)
            .then((p) => setCompleted(p.completedRoutes))
            .catch((e) => {
                setCompleted([]);
                toast(`Einführungs-Fortschritt konnte nicht geladen werden: ${errorMessage(e)}`, "warning");
            });
    }, [rolle, routePath, toast]);

    const onDone = useCallback(async () => {
        if (!rolle || !step) return;
        try {
            const next = await markOnboardingRouteDone(rolle, step.routePath);
            setCompleted(next.completedRoutes);
            setDismissed(true);
        } catch (e) {
            toast(`Einführungs-Fortschritt konnte nicht gespeichert werden: ${errorMessage(e)}`, "error");
        }
    }, [rolle, step, toast]);

    if (!rolle || !step || dismissed || completed.includes(step.routePath)) {
        return null;
    }

    const idx = steps.findIndex((s) => s.routePath === step.routePath);
    const total = steps.length;

    return (
        <DismissibleNotice
            className="app-notice--fixed"
            variant="info"
            role="region"
            ariaLabel="Einführung"
            onDismiss={() => setDismissed(true)}
            title={
                <>
                    Einführung · Schritt {idx + 1}/{total} · {Math.round(ratio * 100)} % Routen
                </>
            }
            subtitle={step.titleDe}
            actions={
                <>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDismissed(true)}>
                        Später
                    </Button>
                    <Button type="button" size="sm" onClick={() => void onDone()}>
                        Verstanden
                    </Button>
                </>
            }
        >
            {step.bodyDe}
        </DismissibleNotice>
    );
}
