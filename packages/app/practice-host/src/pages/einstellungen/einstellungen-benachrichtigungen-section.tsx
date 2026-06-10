import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import { SettingsSwitch } from "@/views/components/settings-switch";
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
    const { canOpsSystem } = useRbac();
    return (
        <section className="settings-subcard">
            <div className="card-head">
                <div>
                    <div className="card-title">Benachrichtigungen</div>
                    <div className="card-sub">Hinweise und Erinnerungen in der App</div>
                </div>
            </div>
            <div className="settings-row">
                <div>
                    <b>Push-Benachrichtigungen</b>
                    <div className="card-sub">Neue Freigaben, Termine, Bestellungen</div>
                </div>
                <SettingsSwitch
                    ariaLabel="Push-Benachrichtigungen"
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
                    <b>E-Mail-Zusammenfassung</b>
                    <div className="card-sub">Täglich um 18:00</div>
                </div>
                <SettingsSwitch
                    ariaLabel="E-Mail-Zusammenfassung"
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
                    <b>Kritische Warnungen</b>
                    <div className="card-sub">Lagerbestand, Freigaben über 24h</div>
                </div>
                <SettingsSwitch
                    ariaLabel="Kritische Warnungen"
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
                    <b>Patienten-SMS (Erinnerungen)</b>
                    <div className="card-sub">24h vor dem Termin</div>
                </div>
                <SettingsSwitch
                    ariaLabel="Patienten-SMS"
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
                        <b>Hersteller-Lieferung</b> (bei aktivem Hersteller-Portal): Push{" "}
                        {portalFlags.notifications_push_delivery === true ? "live" : "aus"}, E-Mail-Digest{" "}
                        {portalFlags.notifications_email_digest_delivery === true ? "live" : "aus"}, Patienten-SMS{" "}
                        {portalFlags.notifications_patient_sms_delivery === true ? "live" : "aus"}.
                    </div>
                </div>
            ) : null}
        </section>
    );
}
