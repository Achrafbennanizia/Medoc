import { useT } from "@/lib/i18n";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { verbundActivateLicense } from "@/systems/practice-host/controllers/verbund.controller";
import { useVerbundStore } from "@/models/store/verbund-store";
import { OnboardingShell } from "@/views/components/onboarding-shell";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

/** Step 1: license code activates a new practice network (owner device). */
export function LizenzAktivierenOnboardingPage() {
    const t = useT();
    const navigate = useNavigate();
    const setStatus = useVerbundStore((s) => s.setStatus);
    const toast = useToastStore((s) => s.add);
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);

    const activate = async () => {
        const trimmed = code.trim();
        if (!trimmed) {
            toast(t("onboarding.license.paste_key"), "error");
            return;
        }
        setBusy(true);
        try {
            const status = await verbundActivateLicense(trimmed);
            setStatus(status);
            if (status.licensed) {
                toast(t("onboarding.license.success_setup"), "success");
                navigate("/onboarding/abonnement", { replace: true });
            } else {
                toast(t("onboarding.license.invalid"), "error");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        void activate();
    };

    return (
        <OnboardingShell>
            <h1>{t("onboarding.license.title")}</h1>
            <p className="card-sub">{t("onboarding.license.intro_step1")}</p>
            <form onSubmit={onSubmit}>
                <label className="onboarding-field">
                    {t("onboarding.license.key_label")}
                    <input
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder={t("onboarding.license.key_ph_simple")}
                        autoComplete="off"
                        autoFocus
                        spellCheck={false}
                        disabled={busy}
                    />
                </label>
                {import.meta.env.DEV ? (
                    <p className="card-sub" style={{ fontSize: 12, color: "var(--fg-3)", marginTop: -8 }}>
                        {t("onboarding.license.dev_short_code_hint")}
                    </p>
                ) : null}
                <div className="onboarding-actions">
                    <Button type="submit" disabled={busy} loading={busy}>
                        {t("onboarding.license.activate_btn")}
                    </Button>
                </div>
            </form>
            <p className="card-sub" style={{ marginTop: 20, marginBottom: 0, textAlign: "center" }}>
                <Link to="/onboarding/beitreten" className="btn btn-subtle" style={{ display: "inline-block" }}>
                    {t("onboarding.verbund.join")}
                </Link>
            </p>
        </OnboardingShell>
    );
}
