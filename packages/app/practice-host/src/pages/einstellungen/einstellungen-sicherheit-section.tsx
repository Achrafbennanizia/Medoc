import { Link } from "react-router-dom";
import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import { DATENSCHUTZ_UI_ENABLED } from "@/lib/datenschutz-config";
import { useRbac } from "@/lib/use-rbac";
import { useT, useTParams } from "@/lib/i18n";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { EinstellungenDeviceSessionsSection } from "./einstellungen-device-sessions-section";

type SecurityPrefs = NonNullable<ClientSettingsV1["security"]>;

export type EinstellungenSicherheitSectionProps = {
    security: SecurityPrefs;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
};

export function EinstellungenSicherheitSection({
    security,
    onPersistClient,
}: EinstellungenSicherheitSectionProps) {
    const { canReadAudit, canRoute, canOpsSystem } = useRbac();
    const t = useT();
    const tp = useTParams();

    const idleOn = (security.idleLogoutMinutes ?? 0) > 0;
    const idleMins = security.idleLogoutMinutes ?? 0;

    const showDatenschutzLink = DATENSCHUTZ_UI_ENABLED && canRoute("datenschutz");
    const showComplianceLinks = canReadAudit || showDatenschutzLink;

    const idleHint = idleOn
        ? idleMins === 1
            ? tp("settings.security.idle_on_one", { minutes: idleMins })
            : tp("settings.security.idle_on_many", { minutes: idleMins })
        : t("settings.security.idle_off");

    return (
        <div className="settings-security-stack">
            <section className="settings-subcard settings-security-card">
                <div className="card-head">
                    <div>
                        <div className="card-title">{t("settings.security.title")}</div>
                        <div className="card-sub">{t("settings.security.subtitle_no_totp")}</div>
                    </div>
                </div>

                <div className="settings-security-group">
                    <div className="settings-security-group__title">{t("settings.security.session_group")}</div>

                    {canOpsSystem ? (
                        <div className="settings-row settings-security-row">
                            <div className="settings-security-row__body">
                                <b>{t("settings.security.idle_lock")}</b>
                                <div className="card-sub">{idleHint}</div>
                            </div>
                            <SettingsSwitch
                                ariaLabel={t("settings.security.idle_lock.aria")}
                                checked={idleOn}
                                onChange={() =>
                                    onPersistClient((c) => {
                                        const s = c.security ?? DEFAULT_CLIENT_SETTINGS.security!;
                                        const on = (s.idleLogoutMinutes ?? 0) > 0;
                                        return mergeClientSettingsPatch(c, {
                                            security: { ...s, idleLogoutMinutes: on ? 0 : 5 },
                                        });
                                    })
                                }
                            />
                        </div>
                    ) : null}
                </div>

                {showComplianceLinks ? (
                    <div className="settings-security-group">
                        <div className="settings-security-group__title">{t("settings.security.compliance_group")}</div>

                        {canReadAudit ? (
                            <div className="settings-row settings-security-row">
                                <div className="settings-security-row__body">
                                    <b>{t("settings.security.audit_title")}</b>
                                    <div className="card-sub">{t("settings.security.audit.hint")}</div>
                                </div>
                                <Link to="/audit" className="btn btn-subtle settings-security-link-btn">
                                    {t("common.show")}
                                </Link>
                            </div>
                        ) : null}

                        {showDatenschutzLink ? (
                            <div className="settings-row settings-security-row">
                                <div className="settings-security-row__body">
                                    <b>{t("settings.security.dsgvo_title")}</b>
                                    <div className="card-sub">{t("settings.security.gdpr.hint")}</div>
                                </div>
                                <Link to="/datenschutz" className="btn btn-subtle settings-security-link-btn">
                                    {t("common.request")}
                                </Link>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </section>

            <EinstellungenDeviceSessionsSection />
        </div>
    );
}

/*
 * TODO(deferred-security): 2FA settings panel unwired — re-enable with TOTP_2FA_ENABLED.
 * See docs/coordination/todos-deferred-security-features.md and totp.controller.ts.
 */
