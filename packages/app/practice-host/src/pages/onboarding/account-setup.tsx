import { useT, useTParams } from "@/lib/i18n";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
    onboardingUseExistingAccount,
    registerOnboardingMemberAccount,
} from "@/systems/practice-host/controllers/cluster.controller";
import { passwordPolicyError } from "@/lib/password-policy";
import { OnboardingShell } from "@/views/components/onboarding-shell";
import { PasswordPolicyHints } from "@/views/components/password-policy-hints";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

type Phase = "choice" | "create";
type MemberRole = "PHYSICIAN" | "RECEPTION";

export function AccountSetupOnboardingPage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [phase, setPhase] = useState<Phase>("choice");
    const [busy, setBusy] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [role, setRole] = useState<MemberRole>("RECEPTION");

    const useExisting = async () => {
        setBusy(true);
        try {
            await onboardingUseExistingAccount();
            navigate("/login", { replace: true });
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const createAccount = async () => {
        const policyErr = passwordPolicyError(t, password);
        if (policyErr) {
            toast(policyErr, "error");
            return;
        }
        if (password !== passwordConfirm) {
            toast(t("onboarding.account.password_mismatch"), "error");
            return;
        }
        setBusy(true);
        try {
            await registerOnboardingMemberAccount({
                name: name.trim(),
                email: email.trim(),
                password,
                role,
            });
            toast(t("onboarding.account.created"), "success");
            navigate("/login", { replace: true });
        } catch (e) {
            toast(tp("onboarding.account.error", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    if (phase === "choice") {
        return (
            <OnboardingShell wide scrollable>
                <div className="onboarding-card__scroll">
                    <h1>{t("onboarding.account.title")}</h1>
                    <p className="card-sub">{t("onboarding.account.intro_member")}</p>
                    <div className="license-device-role-grid__cards">
                        <button
                            type="button"
                            className="license-device-role-card"
                            disabled={busy}
                            onClick={() => setPhase("create")}
                        >
                            <strong>{t("onboarding.account.create_new_title")}</strong>
                            <span className="card-sub">{t("onboarding.account.create_new_body")}</span>
                        </button>
                        <button
                            type="button"
                            className="license-device-role-card"
                            disabled={busy}
                            onClick={() => void useExisting()}
                        >
                            <strong>{t("onboarding.account.existing_title")}</strong>
                            <span className="card-sub">{t("onboarding.account.existing_body")}</span>
                        </button>
                    </div>
                </div>
                <div className="onboarding-card__footer">
                    <div className="onboarding-actions">
                        <Link to="/onboarding/join" className="btn btn-subtle">
                            {t("onboarding.account.back_join")}
                        </Link>
                    </div>
                </div>
            </OnboardingShell>
        );
    }

    return (
        <OnboardingShell wide scrollable>
            <div className="onboarding-card__scroll">
                <h1>{t("onboarding.account.create_form_title")}</h1>
                <p className="card-sub">{t("onboarding.account.create_form_intro")}</p>

                <fieldset className="onboarding-fieldset">
                    <legend>{t("onboarding.account.section_profile")}</legend>
                    <label className="onboarding-field">
                        {t("onboarding.subscription.admin_name")}
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="name"
                            required
                        />
                    </label>
                    <label className="onboarding-field">
                        {t("onboarding.subscription.admin_email")}
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </label>
                    <label className="onboarding-field">
                        {t("onboarding.subscription.admin_password")}
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            required
                        />
                    </label>
                    <label className="onboarding-field">
                        {t("onboarding.subscription.admin_password_confirm")}
                        <input
                            type="password"
                            value={passwordConfirm}
                            onChange={(e) => setPasswordConfirm(e.target.value)}
                            autoComplete="new-password"
                            required
                        />
                    </label>
                    <PasswordPolicyHints password={password} idPrefix="onb-acct-pw" />
                    <label className="onboarding-field">
                        {t("onboarding.account.role_label")}
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as MemberRole)}
                        >
                            <option value="RECEPTION">{t("onboarding.account.role_reception")}</option>
                            <option value="PHYSICIAN">{t("onboarding.account.role_physician")}</option>
                        </select>
                    </label>
                </fieldset>
            </div>
            <div className="onboarding-card__footer">
                <div className="onboarding-actions onboarding-actions--row">
                    <Button type="button" disabled={busy} loading={busy} onClick={() => void createAccount()}>
                        {t("onboarding.account.submit_create")}
                    </Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => setPhase("choice")}>
                        {t("onboarding.subscription.back")}
                    </Button>
                </div>
            </div>
        </OnboardingShell>
    );
}
