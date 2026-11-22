import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import { SettingsSwitch } from "@/views/components/settings-switch";
import {
    ensureOsNotificationPermission,
    osNotificationsSupported,
    playNotificationChime,
    sendOsNotification,
} from "@/systems/practice-host/notifications/notification-delivery";
import { useT, useTParams } from "@/lib/i18n";
import { useRbac } from "@/lib/use-rbac";

type NotificationPrefs = NonNullable<ClientSettingsV1["notifications"]>;

export type SettingsNotificationsSectionProps = {
    notifications: NotificationPrefs;
    portalFlags: Record<string, unknown> | null;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
};

export function SettingsNotificationsSection({
    notifications,
    portalFlags,
    onPersistClient,
}: SettingsNotificationsSectionProps) {
    const t = useT();
    const tp = useTParams();
    const { canOpsSystem } = useRbac();
    const liveLabel = t("common.live");
    const offLabel = t("common.off");
    /**
     * E-mail digest and patient SMS need a delivery channel (manufacturer portal). Without it the toggles
     * cannot do anything, so they are shown disabled with the reason instead of pretending to work.
     */
    const emailAvailable = portalFlags?.notifications_email_digest_delivery === true;
    const smsAvailable = portalFlags?.notifications_patient_sms_delivery === true;
    const osSupported = osNotificationsSupported();
    const soundOn = notifications.sound !== false;
    const volume = typeof notifications.soundVolume === "number" ? notifications.soundVolume : 0.6;
    const patch = (next: Partial<NotificationPrefs>) =>
        onPersistClient((c) =>
            mergeClientSettingsPatch(c, { notifications: { ...(c.notifications ?? DEFAULT_CLIENT_SETTINGS.notifications!), ...next } }),
        );
    const sendTest = async () => {
        const notice = {
            id: `test:${Date.now()}`,
            source: "test",
            category: "system" as const,
            severity: "info" as const,
            title: t("settings.notifications.test_title"),
            body: t("settings.notifications.test_body"),
            at: new Date(),
            unread: true,
        };
        if (soundOn) playNotificationChime("info", volume);
        if (notifications.push !== false) await sendOsNotification(notice, soundOn);
    };

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
                    {!osSupported ? <div className="card-sub settings-row__note">{t("settings.notifications.os_unsupported")}</div> : null}
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.notifications.push_aria")}
                    checked={notifications.push !== false}
                    onChange={() => {
                        const next = notifications.push === false;
                        patch({ push: next });
                        if (next) void ensureOsNotificationPermission();
                    }}
                />
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.notifications.sound")}</b>
                    <div className="card-sub">{t("settings.notifications.sound_detail")}</div>
                </div>
                <div className="settings-notification-sound">
                    {soundOn ? (
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.1}
                            value={volume}
                            aria-label={t("settings.notifications.volume_aria")}
                            onChange={(e) => patch({ soundVolume: Number(e.target.value) })}
                            onMouseUp={() => playNotificationChime("info", volume)}
                        />
                    ) : null}
                    <SettingsSwitch ariaLabel={t("settings.notifications.sound")} checked={soundOn} onChange={() => patch({ sound: !soundOn })} />
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.notifications.test")}</b>
                    <div className="card-sub">{t("settings.notifications.test_detail")}</div>
                </div>
                <button type="button" className="btn btn-subtle" onClick={() => void sendTest()}>
                    {t("settings.notifications.test_btn")}
                </button>
            </div>
            <div className="settings-row">
                <div>
                    <b>{t("settings.notifications.email")}</b>
                    <div className="card-sub">{t("settings.notifications.email_detail")}</div>
                    {!emailAvailable ? <div className="card-sub settings-row__note">{t("settings.notifications.channel_unavailable")}</div> : null}
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.notifications.email_aria")}
                    disabled={!emailAvailable}
                    checked={emailAvailable && notifications.emailSummary !== false}
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
                    {!smsAvailable ? <div className="card-sub settings-row__note">{t("settings.notifications.channel_unavailable")}</div> : null}
                </div>
                <SettingsSwitch
                    ariaLabel={t("settings.notifications.sms_aria")}
                    disabled={!smsAvailable}
                    checked={smsAvailable && notifications.patientSms === true}
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
                <div className="card-pad" style={{ borderTop: "1px solid var(--line-strong)", paddingTop: "var(--space-3)" }}>
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
