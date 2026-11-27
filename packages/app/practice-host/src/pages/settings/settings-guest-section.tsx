/**
 * Settings → Security → Guest account (Solo, editions-plan.md §4.2). The admin creates the one
 * guest sign-in, sets its password, turns it on or off and decides whether it may read the
 * clinical record. What the guest changes waits in the inbox.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "@/lib/i18n";
import { errorMessage } from "@/lib/utils";
import { getGuestAccount, setGuestAccount, type GuestAccount } from "@/systems/practice-host/controllers/guest.controller";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { Button } from "@/views/components/ui/button";
import { Input } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";

export function SettingsGuestSection() {
    const t = useT();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [account, setAccount] = useState<GuestAccount | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [clinicalRead, setClinicalRead] = useState(false);
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        void getGuestAccount()
            .then((a) => {
                setAccount(a);
                setEnabled(a.enabled);
                setClinicalRead(a.clinicalRead);
            })
            .catch((e: unknown) => setError(errorMessage(e)));
    }, []);

    const needsPassword = account != null && !account.exists;
    const dirty =
        account != null && (enabled !== account.enabled || clinicalRead !== account.clinicalRead || password.trim() !== "");

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            const next = await setGuestAccount({ enabled, clinicalRead, password: password.trim() || undefined });
            setAccount(next);
            setPassword("");
            toast(t("settings.guest.saved"), "success");
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="settings-subcard settings-security-card" aria-labelledby="settings-guest-title">
            <div className="card-head">
                <div>
                    <div className="card-title" id="settings-guest-title">{t("settings.guest.title")}</div>
                    <div className="card-sub">{t("settings.guest.hint")}</div>
                </div>
            </div>
            {account ? (
                <div className="settings-security-group">
                    <div className="settings-row settings-security-row">
                        <div className="settings-security-row__body">
                            <b>{t("settings.guest.enabled")}</b>
                            <div className="card-sub">{t("settings.guest.login")} <code>{account.email}</code></div>
                        </div>
                        <SettingsSwitch ariaLabel={t("settings.guest.enabled")} checked={enabled} onChange={setEnabled} />
                    </div>
                    <div className="settings-row settings-security-row">
                        <div className="settings-security-row__body">
                            <b>{t("settings.guest.clinical")}</b>
                            <div className="card-sub">{t("settings.guest.clinical_hint")}</div>
                        </div>
                        <SettingsSwitch ariaLabel={t("settings.guest.clinical")} checked={clinicalRead} onChange={setClinicalRead} />
                    </div>
                    <div className="settings-row settings-security-row">
                        <div className="settings-security-row__body" style={{ flex: "1 1 18rem" }}>
                            <Input
                                type="password"
                                autoComplete="new-password"
                                label={needsPassword ? t("settings.guest.password_new") : t("settings.guest.password_change")}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required={needsPassword}
                            />
                            <div className="card-sub">{t("settings.guest.password_rule")}</div>
                        </div>
                    </div>
                    {error ? (
                        <div className="settings-row settings-security-row" role="alert">
                            <div className="settings-security-row__body text-error">{error}</div>
                        </div>
                    ) : null}
                    <div className="settings-row settings-security-row settings-guest-actions">
                        <Button size="sm" variant="ghost" onClick={() => navigate("/inbox")}>
                            {t("settings.guest.open_inbox")}
                        </Button>
                        <Button
                            size="sm"
                            loading={busy}
                            disabled={!dirty || (needsPassword && password.trim() === "")}
                            onClick={() => void save()}
                        >
                            {t("settings.guest.save")}
                        </Button>
                    </div>
                </div>
            ) : error ? (
                <p className="card-sub text-error" role="alert">{error}</p>
            ) : null}
        </section>
    );
}
