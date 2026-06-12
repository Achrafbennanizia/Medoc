/**
 * Pre-login gate: unlicensed and unprovisioned installs see only onboarding routes.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { verbundGetStatus } from "@/systems/practice-host/controllers/verbund.controller";
import { VERBUND_STATUS_READY, useVerbundStore } from "@/models/store/verbund-store";

const STATUS_LOAD_TIMEOUT_MS = 7000;

export function VerbundOnboardingGate({ children }: { children: ReactNode }) {
    const location = useLocation();
    const status = useVerbundStore((s) => s.status);
    const setStatus = useVerbundStore((s) => s.setStatus);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const needsOnboarding =
        status === null ? true : !status.licensed && !status.provisioned;

    const refreshStatus = useCallback(() => {
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        setLoading(true);
        setLoadError(null);
        void Promise.race([
            verbundGetStatus(),
            new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error("timeout")), STATUS_LOAD_TIMEOUT_MS);
            }),
        ])
            .then((nextStatus) => {
                setStatus(nextStatus);
                setLoading(false);
            })
            .catch(() => {
                setStatus(null);
                setLoading(false);
                setLoadError("Verbund-Status konnte nicht geladen werden.");
            })
            .finally(() => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
            });
    }, [setStatus]);

    useEffect(() => {
        refreshStatus();
    }, [refreshStatus]);

    if (loading && status === null) {
        return (
            <div className="route-fallback" role="status">
                Verbund-Status wird geladen …
            </div>
        );
    }

    if (!loading && status === null && loadError) {
        return (
            <div className="route-fallback" style={{ padding: 20, display: "grid", gap: 12 }}>
                <div role="alert">{loadError}</div>
                <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-subtle" onClick={refreshStatus}>
                        Erneut versuchen
                    </button>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            setLoadError(null);
                            setLoading(false);
                            setStatus(VERBUND_STATUS_READY);
                        }}
                    >
                        Ohne Verbund fortfahren
                    </button>
                </div>
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
