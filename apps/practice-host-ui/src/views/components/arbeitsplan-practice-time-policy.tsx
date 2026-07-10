import { Link } from "react-router-dom";
import { useT } from "@/lib/i18n";
import { SettingsSwitch } from "./settings-switch";

type Props = {
    autoRecordOnLogin: boolean;
    autoRecordOnLogout: boolean;
    busy?: boolean;
    onAutoLoginChange: (next: boolean) => void;
    onAutoLogoutChange: (next: boolean) => void;
};

/** Practice-wide time tracking defaults — styled like Einstellungen rows. */
export function ArbeitsplanPracticeTimePolicy({
    autoRecordOnLogin,
    autoRecordOnLogout,
    busy = false,
    onAutoLoginChange,
    onAutoLogoutChange,
}: Props) {
    const t = useT();

    return (
        <section className="card arbeitsplan-time-policy-card">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("page.arbeitsplan.time_tracking")}</div>
                    <div className="card-sub">{t("page.arbeitsplan.time_tracking.subtitle")}</div>
                </div>
            </div>
            <div className="settings-subcard settings-subcard--segment-safe">
                <div className="settings-row">
                    <div>
                        <b>{t("page.arbeitsplan.time_tracking.auto_login")}</b>
                        <div className="card-sub">{t("page.arbeitsplan.time_tracking.auto_login_hint")}</div>
                    </div>
                    <SettingsSwitch
                        ariaLabel={t("page.arbeitsplan.time_tracking.auto_login")}
                        checked={autoRecordOnLogin}
                        disabled={busy}
                        onChange={onAutoLoginChange}
                    />
                </div>
                <div className="settings-row">
                    <div>
                        <b>{t("page.arbeitsplan.time_tracking.auto_logout")}</b>
                        <div className="card-sub">{t("page.arbeitsplan.time_tracking.auto_logout_hint")}</div>
                    </div>
                    <SettingsSwitch
                        ariaLabel={t("page.arbeitsplan.time_tracking.auto_logout")}
                        checked={autoRecordOnLogout}
                        disabled={busy}
                        onChange={onAutoLogoutChange}
                    />
                </div>
            </div>
            <p className="arbeitsplan-time-policy-links">
                <Link to="/verwaltung/team/arbeitszeit" className="nav-link-forward">
                    {t("page.arbeitsplan.link.team_work_time")}
                </Link>
                <span className="arbeitsplan-time-policy-links__sep" aria-hidden>
                    ·
                </span>
                <Link to="/personal/arbeitszeit" className="nav-link-forward">
                    {t("page.arbeitsplan.link.own_work_time")}
                </Link>
            </p>
        </section>
    );
}
