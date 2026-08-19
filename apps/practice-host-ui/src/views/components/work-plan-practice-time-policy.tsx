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

/** Practice-wide time tracking defaults — styled like Settings rows. */
export function WorkPlanPracticeTimePolicy({
    autoRecordOnLogin,
    autoRecordOnLogout,
    busy = false,
    onAutoLoginChange,
    onAutoLogoutChange,
}: Props) {
    const t = useT();

    return (
        <section className="card work_plan-time-policy-card">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("page.work_plan.time_tracking")}</div>
                    <div className="card-sub">{t("page.work_plan.time_tracking.subtitle")}</div>
                </div>
            </div>
            <div className="settings-subcard settings-subcard--segment-safe">
                <div className="settings-row">
                    <div>
                        <b>{t("page.work_plan.time_tracking.auto_login")}</b>
                        <div className="card-sub">{t("page.work_plan.time_tracking.auto_login_hint")}</div>
                    </div>
                    <SettingsSwitch
                        ariaLabel={t("page.work_plan.time_tracking.auto_login")}
                        checked={autoRecordOnLogin}
                        disabled={busy}
                        onChange={onAutoLoginChange}
                    />
                </div>
                <div className="settings-row">
                    <div>
                        <b>{t("page.work_plan.time_tracking.auto_logout")}</b>
                        <div className="card-sub">{t("page.work_plan.time_tracking.auto_logout_hint")}</div>
                    </div>
                    <SettingsSwitch
                        ariaLabel={t("page.work_plan.time_tracking.auto_logout")}
                        checked={autoRecordOnLogout}
                        disabled={busy}
                        onChange={onAutoLogoutChange}
                    />
                </div>
            </div>
            <p className="work_plan-time-policy-links">
                <Link to="/administration/team/work-time" className="nav-link-forward">
                    {t("page.work_plan.link.team_work_time")}
                </Link>
                <span className="work_plan-time-policy-links__sep" aria-hidden>
                    ·
                </span>
                <Link to="/staff/work-time" className="nav-link-forward">
                    {t("page.work_plan.link.own_work_time")}
                </Link>
            </p>
        </section>
    );
}
