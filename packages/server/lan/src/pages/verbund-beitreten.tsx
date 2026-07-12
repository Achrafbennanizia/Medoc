/**
 * Join practice federation — pairing only (no practice data visible).
 */

import { Link } from "react-router-dom";

import { VerbundJoinFlow } from "@/systems/practice-host/components/verbund-join-flow";
import { useT } from "@/lib/i18n";
import { OnboardingShell } from "@/views/components/onboarding-shell";

export function VerbundBeitretenPage() {
    const t = useT();

    return (
        <OnboardingShell>
            <h1>{t("page.lan.verbund_join.title")}</h1>
            <p className="card-sub">{t("page.lan.verbund_join.subtitle")}</p>
            <VerbundJoinFlow completeWithAccountSetup />
            <div className="onboarding-actions" style={{ marginTop: 16 }}>
                <Link to="/onboarding" className="btn btn-subtle">
                    {t("page.lan.verbund_join.back")}
                </Link>
            </div>
        </OnboardingShell>
    );
}
