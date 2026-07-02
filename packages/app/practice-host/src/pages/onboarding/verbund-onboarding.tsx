import { Link } from "react-router-dom";
import { useT } from "@/lib/i18n";
import { useVerbundStore } from "@/models/store/verbund-store";
import { OnboardingShell } from "@/views/components/onboarding-shell";

export function VerbundOnboardingPage() {
    const t = useT();
    const status = useVerbundStore((s) => s.status);
    const setupNewDisabled =
        status != null && !status.isOwner && (status.provisioned || status.clusterId != null);

    return (
        <OnboardingShell>
            <h1>{t("onboarding.verbund.title")}</h1>
            <p className="card-sub">{t("onboarding.verbund.subtitle")}</p>
            <div className="onboarding-actions">
                {setupNewDisabled ? (
                    <span
                        className="btn btn-accent"
                        aria-disabled="true"
                        title={t("onboarding.verbund.setup_new_disabled_hint")}
                        style={{ opacity: 0.55, cursor: "not-allowed", pointerEvents: "none" }}
                    >
                        {t("onboarding.verbund.setup_new")}
                    </span>
                ) : (
                    <Link to="/onboarding/aktivierung" className="btn btn-accent">
                        {t("onboarding.verbund.setup_new")}
                    </Link>
                )}
                <Link to="/onboarding/beitreten" className="btn btn-subtle">
                    {t("onboarding.verbund.join")}
                </Link>
            </div>
            {setupNewDisabled ? (
                <p className="card-sub" style={{ marginTop: 12 }}>
                    {t("onboarding.verbund.setup_new_disabled_hint")}
                </p>
            ) : null}
        </OnboardingShell>
    );
}
