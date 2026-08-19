import { useT } from "@/lib/i18n";
/**
 * Post-login gate for the master/replica activation flow.
 *
 * Decisions:
 *
 * 1. Replica (mode = serverless_peer, role = REPLICA) without an
 *    `activationToken` → render the pairing-scan page.
 * 2. Practice device-mesh member provisioned through the owner primary device → any
 *    logged-in user may use the app (no local vendor license required).
 * 3. Master (anything else) without a valid v2/v1 license → render
 *    the license-activate page (first: primary vs secondary device, then
 *    company token or device-mesh join respectively).
 * 4. Otherwise → render children unchanged.
 *
 * Runs only inside `ProtectedRoute` so the user is already authenticated.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { errorMessage } from "@/lib/utils";
import { syncGetStatus } from "@/systems/practice-host/controllers/sync.controller";
import { currentLicenseStatus } from "@/systems/practice-host/controllers/system.controller";
import { clusterGetStatus } from "@/systems/practice-host/controllers/cluster.controller";
import { LicenseActivatePage } from "@/systems/practice-host/pages/license-activate";
import { PairingScanPage } from "@/systems/lan/pages/pairing-scan";

type Decision = "loading" | "ok" | "needs-license" | "needs-pairing" | "error";

export function LicenseAndPairingGate({ children }: { children: ReactNode }) {
    const t = useT();
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
            const cluster = await clusterGetStatus().catch(() => null);
            if (cluster?.provisioned && !cluster.isOwner) {
                setDecision("ok");
                return;
            }
            const status = await currentLicenseStatus().catch(() => null);
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
                {t("license.activate.checking")}
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
                <p>{t("license.activate.check_failed")}</p>
                {errorDetail ? <p className="text-muted">{errorDetail}</p> : null}
                <button type="button" onClick={() => void evaluate()}>
                    {t("license.activate.retry")}
                </button>
            </div>
        );
    }

    return <>{children}</>;
}
