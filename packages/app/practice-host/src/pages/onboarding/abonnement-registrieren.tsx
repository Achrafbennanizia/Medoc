import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    onboardingSubscriptionStatus,
    registerOnboardingSubscription,
    type OnboardingSubscriptionRequest,
} from "@/systems/practice-host/controllers/verbund.controller";
import { OnboardingShell } from "@/views/components/onboarding-shell";
import { Button } from "@/views/components/ui/button";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

/** Default until plan-tier UI is restored — see docs/coordination/geplant.md */
const DEFAULT_SUBSCRIPTION_PLAN = "PRO" as const;

function slugFromName(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
}

export function AbonnementRegistrierenOnboardingPage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [busy, setBusy] = useState(false);
    const [setupComplete, setSetupComplete] = useState(false);
    const [needsAdminAccount, setNeedsAdminAccount] = useState(true);
    const [displayName, setDisplayName] = useState("");
    const [practiceSlug, setPracticeSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [adminName, setAdminName] = useState("");
    const [adminEmail, setAdminEmail] = useState("");
    const [adminPassword, setAdminPassword] = useState("");
    const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
    const [street, setStreet] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [city, setCity] = useState("");
    const [acceptTerms, setAcceptTerms] = useState(false);

    useEffect(() => {
        void onboardingSubscriptionStatus()
            .then((s) => {
                setSetupComplete(s.setupComplete);
                setNeedsAdminAccount(s.needsAdminAccount);
            })
            .catch(() => {
                /* gate will retry */
            });
    }, []);

    useEffect(() => {
        if (!slugTouched && displayName.trim()) {
            setPracticeSlug(slugFromName(displayName));
        }
    }, [displayName, slugTouched]);

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
            displayName: displayName.trim(),
            practiceSlug: practiceSlug.trim(),
            adminName: adminName.trim(),
            adminEmail: adminEmail.trim(),
            adminPassword: needsAdminAccount ? adminPassword : undefined,
            street: street.trim() || undefined,
            postalCode: postalCode.trim() || undefined,
            city: city.trim() || undefined,
            plan: DEFAULT_SUBSCRIPTION_PLAN,
        };
        setBusy(true);
        try {
            await registerOnboardingSubscription(payload);
            toast(t("onboarding.subscription.success"), "success");
            navigate("/login", { replace: true });
        } catch (e) {
            toast(tp("onboarding.subscription.error", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    if (setupComplete) {
        return (
            <OnboardingShell wide scrollable>
                <div className="onboarding-card__scroll">
                    <h1>{t("onboarding.practice.title")}</h1>
                    <p className="card-sub">{t("onboarding.subscription.already_registered")}</p>
                </div>
                <div className="onboarding-card__footer">
                    <div className="onboarding-actions">
                        <Button type="button" onClick={() => navigate("/login", { replace: true })}>
                            {t("onboarding.subscription.continue_login")}
                        </Button>
                    </div>
                </div>
            </OnboardingShell>
        );
    }

    return (
        <OnboardingShell wide scrollable>
            <div className="onboarding-card__scroll">
                <h1>{t("onboarding.practice.title")}</h1>
                <p className="card-sub">
                    {needsAdminAccount
                        ? t("onboarding.practice.intro_new_network")
                        : t("onboarding.practice.intro_existing_users")}
                </p>

                <fieldset className="onboarding-fieldset">
                    <legend>{t("onboarding.subscription.section_practice")}</legend>
                    <label className="onboarding-field">
                        {t("onboarding.subscription.display_name")}
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            autoComplete="organization"
                            required
                        />
                    </label>
                    <label className="onboarding-field">
                        {t("onboarding.subscription.slug")}
                        <input
                            type="text"
                            value={practiceSlug}
                            onChange={(e) => {
                                setSlugTouched(true);
                                setPracticeSlug(e.target.value);
                            }}
                            spellCheck={false}
                            required
                        />
                        <span className="card-sub">{t("onboarding.subscription.slug_hint")}</span>
                    </label>
                </fieldset>

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
                        <p className="card-sub">{t("onboarding.subscription.existing_accounts_hint")}</p>
                    )}
                </fieldset>

                <fieldset className="onboarding-fieldset">
                    <legend>{t("onboarding.subscription.section_address")}</legend>
                    <label className="onboarding-field">
                        {t("onboarding.subscription.street")}
                        <input
                            type="text"
                            value={street}
                            onChange={(e) => setStreet(e.target.value)}
                            autoComplete="street-address"
                        />
                    </label>
                    <div className="onboarding-path-row">
                        <label className="onboarding-field onboarding-field--inline">
                            {t("onboarding.subscription.postal_code")}
                            <input
                                type="text"
                                value={postalCode}
                                onChange={(e) => setPostalCode(e.target.value)}
                                autoComplete="postal-code"
                            />
                        </label>
                        <label className="onboarding-field onboarding-field--inline">
                            {t("onboarding.subscription.city")}
                            <input
                                type="text"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                autoComplete="address-level2"
                            />
                        </label>
                    </div>
                </fieldset>

                {/* TODO(later): Plan tier picker — BASIC / PRO / ENTERPRISE cards (see geplant.md) */}

                <label className="onboarding-field onboarding-field--checkbox">
                    <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                    <span>{t("onboarding.subscription.accept_terms")}</span>
                </label>
            </div>

            <div className="onboarding-card__footer">
                <div className="onboarding-actions">
                    <Button type="button" disabled={busy} loading={busy} onClick={() => void submit()}>
                        {needsAdminAccount
                            ? t("onboarding.subscription.submit_btn_create_account")
                            : t("onboarding.subscription.submit_btn")}
                    </Button>
                </div>
            </div>
        </OnboardingShell>
    );
}

/*
 * Deferred — plan tier UI (restore from git history / license-device-role-card pattern):
 *
 * <fieldset className="onboarding-fieldset">
 *   <legend>{t("onboarding.subscription.section_plan")}</legend>
 *   <div className="license-device-role-grid__cards" role="radiogroup" ...>
 *     {planOptions.map(...)}
 *   </div>
 * </fieldset>
 */
