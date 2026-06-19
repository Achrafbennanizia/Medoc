import { Link } from "react-router-dom";
import { useT } from "@/lib/i18n";
import { OnboardingShell } from "@/views/components/onboarding-shell";

export function VerbundOnboardingPage() {
    const t = useT();
    return (
        <OnboardingShell>
            <h1>{t("onboarding.verbund.title")}</h1>
            <p className="card-sub">{t("onboarding.verbund.subtitle")}</p>
            <div className="onboarding-actions">
                <Link to="/onboarding/aktivierung" className="btn btn-accent">
                    {t("onboarding.verbund.setup_new")}
                </Link>
                <Link to="/onboarding/beitreten" className="btn btn-subtle">
                    {t("onboarding.verbund.join")}
                </Link>
            </div>
        </OnboardingShell>
    );
}
