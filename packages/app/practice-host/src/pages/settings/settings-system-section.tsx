import {
    SYSTEM_CHART_PHOTO_VIEWER_ENABLED,
    SYSTEM_APPEARANCE_TOGGLES_ENABLED,
    SYSTEM_COMPANY_PORTAL_ENABLED,
    SYSTEM_DIAGNOSTICS_ENABLED,
    SYSTEM_LAN_HOST_PANEL_ENABLED,
    SYSTEM_OPS_EXTRAS_ENABLED,
    SYSTEM_SERVERLESS_FOCUS_ENABLED,
} from "@/lib/settings-ui-flags";
import { useT } from "@/lib/i18n";
import { SettingsCompanyPortalSection } from "@/systems/company-portal/pages/settings-company-portal-section";
import { SettingsLanHostSection } from "@/systems/lan/pages/settings-lan-host";
import { SettingsDeploymentSection } from "@/systems/practice-host/pages/settings/settings-deployment-section";
import { SettingsPairingInbox } from "@/systems/practice-host/pages/settings/settings-pairing-inbox";
import { DeviceClusterPanel } from "@/systems/practice-host/pages/settings/device-cluster-panel";
import { SettingsNetworkResetSection } from "@/systems/practice-host/pages/settings/settings-network-reset-section";

export type SettingsSystemSectionProps = {
    canOpsSystem: boolean;
};

export function SettingsSystemSection({ canOpsSystem }: SettingsSystemSectionProps) {
    const t = useT();

    if (SYSTEM_SERVERLESS_FOCUS_ENABLED) {
        return (
            <section className="settings-subcard settings-subcard--segment-safe settings-system-section">
                <div className="card-head">
                    <div>
                        <div className="card-title">{t("settings.system.title")}</div>
                        <div className="card-sub">{t("settings.system.subtitle_serverless")}</div>
                    </div>
                </div>
                <div className="settings-system-stack settings-system-stack--flush">
                    <DeviceClusterPanel embedded />
                    <SettingsDeploymentSection embedded showPairingInbox={canOpsSystem} />
                    <SettingsNetworkResetSection canOpsSystem={canOpsSystem} />
                </div>
            </section>
        );
    }

    return (
        <section className="settings-subcard settings-subcard--segment-safe settings-system-section">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.system.title")}</div>
                    <div className="card-sub">{t("settings.system.subtitle_classic")}</div>
                </div>
            </div>
            <div className="settings-system-stack">
                <SettingsDeploymentSection embedded />
                {canOpsSystem && SYSTEM_LAN_HOST_PANEL_ENABLED ? (
                    <>
                        <SettingsPairingInbox embedded />
                        <SettingsLanHostSection embedded />
                    </>
                ) : null}
                {canOpsSystem && SYSTEM_COMPANY_PORTAL_ENABLED ? (
                    <SettingsCompanyPortalSection embedded />
                ) : null}
            </div>
            {!SYSTEM_APPEARANCE_TOGGLES_ENABLED && !SYSTEM_CHART_PHOTO_VIEWER_ENABLED && !SYSTEM_DIAGNOSTICS_ENABLED && !SYSTEM_OPS_EXTRAS_ENABLED ? (
                <p className="card-sub" style={{ padding: "12px var(--card-pad-x)" }}>
                    {t("settings.system.hidden")}
                </p>
            ) : null}
        </section>
    );
}
