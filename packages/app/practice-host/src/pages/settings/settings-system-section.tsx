import {
    SYSTEM_CHART_PHOTO_VIEWER_ENABLED,
    SYSTEM_APPEARANCE_TOGGLES_ENABLED,
    SYSTEM_COMPANY_PORTAL_ENABLED,
    SYSTEM_DIAGNOSTICS_ENABLED,
    SYSTEM_LAN_HOST_PANEL_ENABLED,
    SYSTEM_OPS_EXTRAS_ENABLED,
    SYSTEM_SERVERLESS_FOCUS_ENABLED,
} from "@/lib/settings-ui-flags";
import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    withNetworkHiddenInSettings,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import { persistAutocompleteSuggestionsToPracticeKv } from "@/lib/practice-search-prefs-sync";
import { errorMessage } from "@/lib/utils";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useEffect } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { SettingsCompanyPortalSection } from "@/systems/company-portal/pages/settings-company-portal-section";
import { SettingsLanHostSection } from "@/systems/lan/pages/settings-lan-host";
import { SettingsDeploymentSection } from "@/systems/practice-host/pages/settings/settings-deployment-section";
import { SettingsPairingInbox } from "@/systems/practice-host/pages/settings/settings-pairing-inbox";
import { setNetworkHidden } from "@/systems/practice-host/controllers/cluster.controller";
import { DeviceClusterPanel } from "@/systems/practice-host/pages/settings/device-cluster-panel";
import { SettingsNetworkResetSection } from "@/systems/practice-host/pages/settings/settings-network-reset-section";
import { PDF_HEADER_DESIGNER_ENABLED } from "@/lib/v1-ui-flags";
import { PdfHeaderDesigner } from "@/systems/practice-host/pages/settings/pdf-header-designer";

type WorkflowPrefs = NonNullable<ClientSettingsV1["workflows"]>;
type SearchPrefs = NonNullable<ClientSettingsV1["search"]>;

export type SettingsSystemSectionProps = {
    canOpsSystem: boolean;
    hideNetwork: boolean;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
    calendarDragDropEnabled: boolean;
    onCalendarDragDrop: (enabled: boolean) => void;
    workflows: WorkflowPrefs;
    searchPrefs: SearchPrefs;
};

function PracticeDesktopSettings({
    canOpsSystem,
    calendarDragDropEnabled,
    onCalendarDragDrop,
    workflows,
    searchPrefs,
    onPersistClient,
}: Omit<SettingsSystemSectionProps, "hideNetwork">) {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    return (
        <section className="settings-subcard settings-subcard--segment-safe settings-system-section">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.workflows.appointment_rules_title")}</div>
                </div>
            </div>
            {canOpsSystem ? (
                <div className="settings-row settings-row--wrap">
                    <div className="settings-row__label">
                        <b>{t("settings.workflows.calendar_drag")}</b>
                        <div className="card-sub">{t("settings.workflows.calendar_drag_hint")}</div>
                    </div>
                    <SettingsSwitch
                        ariaLabel={t("settings.workflows.calendar_drag")}
                        checked={calendarDragDropEnabled}
                        onChange={onCalendarDragDrop}
                    />
                </div>
            ) : null}
            <div className="settings-row settings-row--wrap">
                <div className="settings-row__label">
                    <b>{t("settings.workflows.search_insurance_title")}</b>
                    <div className="card-sub">{t("settings.workflows.search_insurance_hint")}</div>
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.workflows.search_insurance_aria")}
                    checked={searchPrefs.patientIncludeInsuranceNumber !== false}
                    onChange={(next) =>
                        onPersistClient((c) => {
                            const s = c.search ?? DEFAULT_CLIENT_SETTINGS.search!;
                            return mergeClientSettingsPatch(c, {
                                search: { ...s, patientIncludeInsuranceNumber: next },
                            });
                        })
                    }
                />
            </div>
            {canOpsSystem ? (
                <div className="settings-row settings-row--wrap">
                    <div className="settings-row__label">
                        <b>{t("settings.workflows.autocomplete_title")}</b>
                        <div className="card-sub">{t("settings.workflows.autocomplete_hint")}</div>
                    </div>
                    <SettingsSwitch
                        ariaLabel={t("settings.workflows.autocomplete_aria")}
                        checked={searchPrefs.autocompleteSuggestionsEnabled !== false}
                        onChange={(next) => {
                            void persistAutocompleteSuggestionsToPracticeKv(next).catch((e) => {
                                toast(tp("settings.workflows.autocomplete_save_failed", { error: errorMessage(e) }), "warning");
                            });
                            onPersistClient((c) => {
                                const s = c.search ?? DEFAULT_CLIENT_SETTINGS.search!;
                                return mergeClientSettingsPatch(c, {
                                    search: { ...s, autocompleteSuggestionsEnabled: next },
                                });
                            });
                        }}
                    />
                </div>
            ) : null}
            <div className="settings-row settings-row--wrap">
                <div className="settings-row__label">
                    <b>{t("settings.workflows.appointment_confirm")}</b>
                    <div className="card-sub">
                        {workflows.appointmentConfirmMode === "auto"
                            ? t("settings.workflows.appointment_confirm_auto")
                            : t("settings.workflows.appointment_confirm_manual")}
                    </div>
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.workflows.appointment_confirm")}
                    checked={workflows.appointmentConfirmMode === "auto"}
                    onChange={(next) =>
                        onPersistClient((c) => {
                            const w = c.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
                            return mergeClientSettingsPatch(c, {
                                workflows: { ...w, appointmentConfirmMode: next ? "auto" : "manual" },
                            });
                        })
                    }
                />
            </div>
        </section>
    );
}

export function SettingsSystemSection({
    canOpsSystem,
    hideNetwork,
    onPersistClient,
    calendarDragDropEnabled,
    onCalendarDragDrop,
    workflows,
    searchPrefs,
}: SettingsSystemSectionProps) {
    const t = useT();
    const toast = useToastStore((s) => s.add);
    const onHideNetwork = (next: boolean) => {
        onPersistClient((c) => withNetworkHiddenInSettings(c, next));
        void setNetworkHidden(next).catch((error: unknown) => {
            if (next) {
                onPersistClient((c) => withNetworkHiddenInSettings(c, false));
            }
            toast(errorMessage(error), "error");
        });
    };
    useEffect(() => {
        if (!__CAP_NET__ || !hideNetwork) return;
        void setNetworkHidden(true).catch(() => undefined);
    }, [hideNetwork]);
    // TODO(later): restore the PDF header designer — see docs/coordination/todos-deferred-ui-blinds.md
    const headerDesigner =
        PDF_HEADER_DESIGNER_ENABLED && canOpsSystem ? <PdfHeaderDesigner /> : null;
    const desktopSettings = (
        <PracticeDesktopSettings
            canOpsSystem={canOpsSystem}
            calendarDragDropEnabled={calendarDragDropEnabled}
            onCalendarDragDrop={onCalendarDragDrop}
            workflows={workflows}
            searchPrefs={searchPrefs}
            onPersistClient={onPersistClient}
        />
    );

    // One-device editions have no practice network to set up (editions-plan.md §6.13).
    if (!__CAP_NET__) {
        return (
            <>
                {canOpsSystem && SYSTEM_COMPANY_PORTAL_ENABLED ? (
                    <section className="settings-subcard settings-subcard--segment-safe settings-system-section">
                        <SettingsCompanyPortalSection embedded />
                    </section>
                ) : null}
                {headerDesigner}
                {desktopSettings}
            </>
        );
    }

    const hideToggle = (
        <div className="settings-row settings-row--wrap settings-row--network-hide">
            <div className="settings-row__label">
                <b>{t("settings.system.hide_network")}</b>
                <div className="card-sub">{t("settings.system.hide_network_detail")}</div>
            </div>
            <SettingsSwitch
                ariaLabel={t("settings.system.hide_network_aria")}
                checked={hideNetwork}
                onChange={onHideNetwork}
            />
        </div>
    );

    if (SYSTEM_SERVERLESS_FOCUS_ENABLED) {
        return (
            <>
            <section className="settings-subcard settings-subcard--segment-safe settings-system-section">
                <div className="card-head">
                    <div>
                        <div className="card-title">{t("settings.system.title")}</div>
                        <div className="card-sub">{t("settings.system.subtitle_serverless")}</div>
                    </div>
                </div>
                {hideToggle}
                {hideNetwork ? (
                    <p className="card-sub settings-system-network-hidden-hint">{t("settings.system.network_hidden_hint")}</p>
                ) : (
                <div className="settings-system-stack settings-system-stack--flush">
                    <DeviceClusterPanel embedded />
                    <SettingsDeploymentSection embedded showPairingInbox={canOpsSystem} />
                    <SettingsNetworkResetSection canOpsSystem={canOpsSystem} />
                </div>
                )}
            </section>
            {headerDesigner}
            {desktopSettings}
            </>
        );
    }

    return (
        <>
        <section className="settings-subcard settings-subcard--segment-safe settings-system-section">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.system.title")}</div>
                    <div className="card-sub">{t("settings.system.subtitle_classic")}</div>
                </div>
            </div>
            {hideToggle}
            {hideNetwork ? (
                <p className="card-sub settings-system-network-hidden-hint">{t("settings.system.network_hidden_hint")}</p>
            ) : (
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
            )}
            {!SYSTEM_APPEARANCE_TOGGLES_ENABLED &&
            !SYSTEM_CHART_PHOTO_VIEWER_ENABLED &&
            !SYSTEM_DIAGNOSTICS_ENABLED &&
            !SYSTEM_OPS_EXTRAS_ENABLED ? (
                <p className="card-sub" style={{ padding: "12px var(--card-pad-x)" }}>
                    {t("settings.system.hidden")}
                </p>
            ) : null}
        </section>
        {headerDesigner}
        {desktopSettings}
        </>
    );
}
