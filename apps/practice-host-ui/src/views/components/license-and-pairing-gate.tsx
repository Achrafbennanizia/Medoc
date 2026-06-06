/**
 * Post-login gate for the master/replica activation flow.
 *
 * Decisions:
 *
 * 1. Replica (mode = serverless_peer, role = REPLICA) without an
 *    `activationToken` → render the pairing-scan page.
 * 2. Master (anything else) without a valid v2/v1 license → render
 *    the license-activate page.
 * 3. Otherwise → render children unchanged.
 *
 * Runs only inside `ProtectedRoute` so the user is already authenticated.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import { errorMessage } from "@/lib/utils";
import { syncGetStatus } from "@/systems/practice-host/controllers/sync.controller";
import { LicenseActivatePage } from "@/systems/practice-host/pages/license-activate";
import { PairingScanPage } from "@/systems/lan/pages/pairing-scan";

type LicenseStatusLite = {
    valid: boolean;
    format: string | null;
};

type Decision = "loading" | "ok" | "needs-license" | "needs-pairing" | "error";

export function LicenseAndPairingGate({ children }: { children: ReactNode }) {
    const [decision, setDecision] = useState<Decision>("loading");
    const [errorDetail, setErrorDetail] = useState<string | null>(null);

    const evaluate = useCallback(async () => {
        try {
            setErrorDetail(null);
            const snap = await syncGetStatus();
            const isReplica =
                snap.deployment.mode === "serverless_peer" && snap.deployment.role === "REPLICA";
            if (isReplica) {
                if (!snap.deployment.activationToken) {
                    setDecision("needs-pairing");
                    return;
                }
                // Paired replicas authenticate via activation token — no vendor license.
                setDecision("ok");
                return;
            }
            const status = await practiceSystem
                .invoke<LicenseStatusLite>("current_license_status")
                .catch(() => null);
            if (!status?.valid) {
                setDecision("needs-license");
                return;
            }
            setDecision("ok");
        } catch (e) {
            setErrorDetail(errorMessage(e));
            setDecision("error");
        }
    }, []);

    useEffect(() => {
        void evaluate();
    }, [evaluate]);

    if (decision === "loading") {
        return (
            <div className="route-fallback" role="status" aria-live="polite">
                Lizenz wird geprüft …
            </div>
        );
    }

    if (decision === "needs-pairing") {
        return <PairingScanPage />;
    }

    if (decision === "needs-license") {
        return <LicenseActivatePage onActivated={() => void evaluate()} />;
    }

    if (decision === "error") {
        return (
            <div className="route-fallback" role="alert">
                <p>Aktivierung konnte nicht geprüft werden.</p>
                {errorDetail ? <p className="text-muted">{errorDetail}</p> : null}
                <button type="button" onClick={() => void evaluate()}>
                    Erneut prüfen
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
