import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { useT, useTParams } from "@/lib/i18n";
import { useRbac } from "@/lib/use-rbac";

type NotificationPrefs = NonNullable<ClientSettingsV1["notifications"]>;

export type EinstellungenBenachrichtigungenSectionProps = {
    notifications: NotificationPrefs;
    portalFlags: Record<string, unknown> | null;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
};

export function EinstellungenBenachrichtigungenSection({
    notifications,
    portalFlags,
    onPersistClient,
}: EinstellungenBenachrichtigungenSectionProps) {
    const t = useT();
    const tp = useTParams();
    const { canOpsSystem } = useRbac();
    const liveLabel = t("common.live");
    const offLabel = t("common.off");

    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">{t("settings.notifications.title")}</div>
                    <div className="card-sub">{t("settings.notifications.subtitle")}</div>
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.notifications.push")}</b>
                    <div className="card-sub">{t("settings.notifications.push_detail")}</div>
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.notifications.push_aria")}
                    checked={notifications.push !== false}
                    onChange={() =>
                        onPersistClient((c) => {
                            const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                            const cur = n.push !== false;
                            return mergeClientSettingsPatch(c, { notifications: { ...n, push: !cur } });
                        })
                    }
                />
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.notifications.email")}</b>
                    <div className="card-sub">{t("settings.notifications.email_detail")}</div>
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.notifications.email_aria")}
                    checked={notifications.emailSummary !== false}
                    onChange={() =>
                        onPersistClient((c) => {
                            const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                            const cur = n.emailSummary !== false;
                            return mergeClientSettingsPatch(c, { notifications: { ...n, emailSummary: !cur } });
                        })
                    }
                />
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.notifications.critical")}</b>
                    <div className="card-sub">{t("settings.notifications.critical_detail")}</div>
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.notifications.critical_aria")}
                    checked={notifications.criticalWarnings !== false}
                    onChange={() =>
                        onPersistClient((c) => {
                            const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                            const cur = n.criticalWarnings !== false;
                            return mergeClientSettingsPatch(c, { notifications: { ...n, criticalWarnings: !cur } });
                        })
                    }
                />
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.notifications.patient_sms")}</b>
                    <div className="card-sub">{t("settings.notifications.patient_sms_detail")}</div>
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.notifications.sms_aria")}
                    checked={notifications.patientSms === true}
                    onChange={() =>
                        onPersistClient((c) => {
                            const n = c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!;
                            const cur = n.patientSms === true;
                            return mergeClientSettingsPatch(c, { notifications: { ...n, patientSms: !cur } });
                        })
                    }
                />
            </div>
            {canOpsSystem && portalFlags && typeof portalFlags === "object" ? (
                <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: 12 }}>
                    <div className="card-sub" style={{ margin: 0, fontSize: 12.5 }}>
                        <b>{t("settings.notifications.manufacturer")}</b>{" "}
                        {tp("settings.notifications.manufacturer_detail", {
                            push: portalFlags.notifications_push_delivery === true ? liveLabel : offLabel,
                            email: portalFlags.notifications_email_digest_delivery === true ? liveLabel : offLabel,
                            sms: portalFlags.notifications_patient_sms_delivery === true ? liveLabel : offLabel,
                        })}
                    </div>
                </div>
            ) : null}
        </section>
    );
}
