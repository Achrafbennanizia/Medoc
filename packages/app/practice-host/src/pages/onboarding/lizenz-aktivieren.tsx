import { useT } from "@/lib/i18n";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { verbundActivateLicense } from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";
import { OnboardingShell } from "@/views/components/onboarding-shell";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

/** Onboarding path: activate license and become cluster owner (first ADMIN seat). */
export function LizenzAktivierenOnboardingPage() {
    const t = useT();
    const navigate = useNavigate();
    const setStatus = useVerbundStore((s) => s.setStatus);
    const toast = useToastStore((s) => s.add);
    const [token, setToken] = useState("");
    const [busy, setBusy] = useState(false);

    const activate = async () => {
        if (!token.trim()) {
            toast(t("onboarding.license.paste_key"), "error");
            return;
        }
        setBusy(true);
        try {
            const status = await verbundActivateLicense(token.trim());
            setStatus(status);
            if (status.licensed) {
                toast(t("onboarding.license.success"), "success");
                navigate("/login", { replace: true });
            } else {
                toast(t("onboarding.license.invalid"), "error");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <OnboardingShell>
            <h1>{t("onboarding.license.title")}</h1>
            <p className="card-sub">{t("onboarding.license.owner_hint")}</p>
            <label className="onboarding-field">
                {t("onboarding.license.key_label")}
                <textarea
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    rows={4}
                    placeholder={t("onboarding.license.key_ph")}
                />
            </label>
            <div className="onboarding-actions onboarding-actions--row">
                <Button type="button" disabled={busy} onClick={() => void activate()}>
                    {t("onboarding.license.activate_btn")}
                </Button>
                <Link to="/onboarding/aktivierung" className="btn btn-subtle">
                    {t("onboarding.license.back")}
                </Link>
            </div>
        </OnboardingShell>
    );
}
