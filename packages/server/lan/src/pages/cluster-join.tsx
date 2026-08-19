/**
 * Join practice federation — pairing only (no practice data visible).
 */

import { Link } from "react-router-dom";

import { ClusterJoinFlow } from "@/systems/practice-host/components/cluster-join-flow";
import { useT } from "@/lib/i18n";
import { OnboardingShell } from "@/views/components/onboarding-shell";

export function ClusterJoinPage() {
    const t = useT();

    return (
        <OnboardingShell>
            <h1>{t("page.lan.cluster_join.title")}</h1>
            <p className="card-sub">{t("page.lan.cluster_join.subtitle")}</p>
            <ClusterJoinFlow completeWithAccountSetup />
            <div className="onboarding-actions" style={{ marginTop: 16 }}>
                <Link to="/onboarding" className="btn btn-subtle">
                    {t("page.lan.cluster_join.back")}
                </Link>
            </div>
        </OnboardingShell>
    );
}
