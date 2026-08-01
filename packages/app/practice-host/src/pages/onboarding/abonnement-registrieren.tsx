import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import {
    onboardingSkipPracticeSetup,
    onboardingSubscriptionStatus,
    registerOnboardingSubscription,
    type OnboardingSubscriptionRequest,
    type OnboardingSubscriptionResult,
} from "@/systems/practice-host/controllers/verbund.controller";
import { OnboardingShell } from "@/views/components/onboarding-shell";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

/** Default until plan-tier UI is restored — see docs/coordination/geplant.md */
const DEFAULT_SUBSCRIPTION_PLAN = "PRO" as const;

export function AbonnementRegistrierenOnboardingPage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [busy, setBusy] = useState(false);
    const [skipBusy, setSkipBusy] = useState(false);
    const [statusLoaded, setStatusLoaded] = useState(false);
    const [needsPracticeSetup, setNeedsPracticeSetup] = useState(true);
    const [needsAdminAccount, setNeedsAdminAccount] = useState(true);
    const [canSkipToLogin, setCanSkipToLogin] = useState(false);
    const [existingAccountEmails, setExistingAccountEmails] = useState<string[]>([]);
    const [loginReadyEmails, setLoginReadyEmails] = useState<string[]>([]);
    const [doneResult, setDoneResult] = useState<OnboardingSubscriptionResult | null>(null);
    const [adminName, setAdminName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
    const [acceptTerms, setAcceptTerms] = useState(false);

    useEffect(() => {
        void onboardingSubscriptionStatus()
            .then((s) => {
                setNeedsPracticeSetup(s.needsPracticeSetup);
                setNeedsAdminAccount(s.needsAdminAccount);
                setCanSkipToLogin(s.canSkipToLogin);
                setExistingAccountEmails(s.existingAccountEmails ?? []);
                setLoginReadyEmails(s.loginReadyEmails ?? []);
                setStatusLoaded(true);
            })
            .catch(() => {
                /* gate will retry */
            });
    }, []);

    const skipToLogin = async () => {
        setSkipBusy(true);
        try {
            await onboardingSkipPracticeSetup();
            navigate("/login", { replace: true });
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setSkipBusy(false);
        }
    };

    const submit = async () => {
        if (!acceptTerms) {
            toast(t("onboarding.subscription.terms_required"), "error");
            return;
        }
        if (needsAdminAccount) {
            if (adminPassword.length < 8) {
                toast(t("onboarding.subscription.password_required"), "error");
                return;
            }
            if (adminPassword !== adminPasswordConfirm) {
                toast(t("onboarding.subscription.password_mismatch"), "error");
                return;
            }
        }
        const payload: OnboardingSubscriptionRequest = {
            displayName: "",
            practiceSlug: "",
            adminName: adminName.trim(),
            adminEmail: adminEmail.trim(),
            adminPassword: needsAdminAccount ? adminPassword : undefined,
            plan: DEFAULT_SUBSCRIPTION_PLAN,
        };
        setBusy(true);
        try {
            const result = await registerOnboardingSubscription(payload);
            setDoneResult(result);
            toast(t("onboarding.subscription.success"), "success");
        } catch (e) {
            toast(tp("onboarding.subscription.error", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    if (!statusLoaded) {
        return (
            <OnboardingShell wide scrollable>
                <p className="card-sub" role="status">
                    {t("onboarding.gate.loading")}
                </p>
            </OnboardingShell>
        );
    }

    if (!needsPracticeSetup) {
        return <Navigate to="/login" replace />;
    }

    if (doneResult) {
        return (
            <OnboardingShell wide scrollable>
                <div className="onboarding-card__scroll">
                    <h1>{t("onboarding.subscription.done_title")}</h1>
                    <p className="card-sub">{t("onboarding.subscription.done_intro")}</p>
                    <div className="onboarding-fieldset" style={{ marginTop: 16 }}>
                        <p className="onboarding-field">
                            <strong>{t("onboarding.subscription.admin_email")}</strong>
                            <code>{doneResult.adminEmail}</code>
                        </p>
                        {doneResult.adminAccountCreated ? (
                            <p className="card-sub">{t("onboarding.subscription.done_password_hint")}</p>
                        ) : (
                            <p className="card-sub">{t("onboarding.subscription.done_existing_hint")}</p>
                        )}
                    </div>
                </div>
                <div className="onboarding-card__footer">
                    <div className="onboarding-actions">
                        <Link to="/login" className="btn btn-primary">
                            {t("onboarding.subscription.continue_login")}
                        </Link>
                    </div>
                </div>
            </OnboardingShell>
        );
    }

    return (
        <OnboardingShell wide scrollable>
            <div className="onboarding-card__scroll">
                <h1>{t("onboarding.subscription.title")}</h1>
                <p className="card-sub">
                    {needsAdminAccount
                        ? t("onboarding.subscription.intro_post_license_new_account")
                        : t("onboarding.subscription.intro_post_license")}
                </p>

                {canSkipToLogin ? (
                    <div className="onboarding-fieldset" style={{ marginBottom: 16 }}>
                        <p className="card-sub">{t("onboarding.subscription.skip_to_login_hint")}</p>
                        {loginReadyEmails.length > 0 ? (
                            <ul className="card-sub" style={{ marginTop: 8 }}>
                                {loginReadyEmails.map((email) => (
                                    <li key={email}>
                                        <code>{email}</code>
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        {import.meta.env.DEV ? (
                            <p className="card-sub" style={{ fontSize: 12, marginTop: 8 }}>
                                {t("onboarding.subscription.skip_dev_password_hint")}
                            </p>
                        ) : null}
                    </div>
                ) : null}

                <fieldset className="onboarding-fieldset">
                    <legend>{t("onboarding.subscription.section_admin")}</legend>
                    <label className="onboarding-field">
                        {t("onboarding.subscription.admin_name")}
                        <input
                            type="text"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            autoComplete="name"
                            required
                        />
                    </label>
                    <label className="onboarding-field">
                        {t("onboarding.subscription.admin_email")}
                        <input
                            type="email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </label>
                    {needsAdminAccount ? (
                        <>
                            <label className="onboarding-field">
                                {t("onboarding.subscription.admin_password")}
                                <input
                                    type="password"
                                    value={adminPassword}
                                    onChange={(e) => setAdminPassword(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </label>
                            <label className="onboarding-field">
                                {t("onboarding.subscription.admin_password_confirm")}
                                <input
                                    type="password"
                                    value={adminPasswordConfirm}
                                    onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                                    autoComplete="new-password"
                                    required
                                />
                            </label>
                        </>
                    ) : (
                        <>
                            <p className="card-sub">{t("onboarding.subscription.existing_accounts_hint")}</p>
                            {existingAccountEmails.length > 0 ? (
                                <ul className="card-sub" style={{ marginTop: 8 }}>
                                    {existingAccountEmails.map((email) => (
                                        <li key={email}>
                                            <code>{email}</code>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </>
                    )}
                </fieldset>

                {/* TODO(later): Plan tier picker — BASIC / PRO / ENTERPRISE cards (see geplant.md) */}

                <label className="onboarding-field onboarding-field--checkbox">
                    <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                    <span>{t("onboarding.subscription.accept_terms")}</span>
                </label>
            </div>

            <div className="onboarding-card__footer">
                <div className="onboarding-actions onboarding-actions--row">
                    <Button type="button" disabled={busy} loading={busy} onClick={() => void submit()}>
                        {needsAdminAccount
                            ? t("onboarding.subscription.submit_btn_create_account")
                            : t("onboarding.subscription.submit_btn")}
                    </Button>
                    {canSkipToLogin ? (
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={busy || skipBusy}
                            loading={skipBusy}
                            onClick={() => void skipToLogin()}
                        >
                            {t("onboarding.subscription.skip_to_login_btn")}
                        </Button>
                    ) : null}
                </div>
            </div>
        </OnboardingShell>
    );
}
