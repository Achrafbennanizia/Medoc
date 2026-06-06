import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
    companyPortalFetchFeatureFlags,
    companyPortalFetchIntegrations,
    listMyDeviceSessions,
    revokeMyOtherDeviceSessions,
    type DeviceSessionRow,
    type HealthCheck,
} from "@/systems/practice-host/controllers/settings-page.controller";
import {
    DEFAULT_CLIENT_SETTINGS,
    mergeClientSettingsPatch,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import { portalIntegrationPill } from "@/lib/settings-format";
import { ShieldIcon } from "@/lib/icons";
import { SettingsSwitch } from "@/views/components/settings-switch";
import { Button } from "@/views/components/ui/button";
import { useToastStore } from "@/views/components/ui/toast-store";

type SecurityPrefs = NonNullable<ClientSettingsV1["security"]>;

export type EinstellungenSicherheitSectionProps = {
    security: SecurityPrefs;
    healthLast: HealthCheck | null;
    onPersistClient: (updater: (c: ClientSettingsV1) => ClientSettingsV1) => void;
};

export function EinstellungenSicherheitSection({
    security,
    healthLast,
    onPersistClient,
}: EinstellungenSicherheitSectionProps) {
    const toast = useToastStore((s) => s.add);
    const [portalIntegrations, setPortalIntegrations] = useState<Record<string, unknown> | null>(null);
    const [portalFlags, setPortalFlags] = useState<Record<string, unknown> | null>(null);
    const [deviceSessions, setDeviceSessions] = useState<DeviceSessionRow[]>([]);
    const [deviceSessionsBusy, setDeviceSessionsBusy] = useState(false);
    const [revokeOtherBusy, setRevokeOtherBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            try {
                const [ff, integ] = await Promise.all([
                    companyPortalFetchFeatureFlags().catch(() => null),
                    companyPortalFetchIntegrations().catch(() => null),
                ]);
                if (cancelled) return;
                if (ff && typeof ff === "object") setPortalFlags(ff as Record<string, unknown>);
                if (integ && typeof integ === "object") setPortalIntegrations(integ as Record<string, unknown>);
            } catch {
                /* optional portal */
            }
            setDeviceSessionsBusy(true);
            const rows = await listMyDeviceSessions().catch(() => []);
            if (!cancelled) {
                setDeviceSessions(Array.isArray(rows) ? rows : []);
                setDeviceSessionsBusy(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const refreshDeviceSessions = useCallback(async () => {
        try {
            setDeviceSessionsBusy(true);
            const rows = await listMyDeviceSessions();
            setDeviceSessions(Array.isArray(rows) ? rows : []);
        } catch {
            setDeviceSessions([]);
        } finally {
            setDeviceSessionsBusy(false);
        }
    }, []);

    const revokeOtherDeviceSessions = async () => {
        setRevokeOtherBusy(true);
        try {
            const n = await revokeMyOtherDeviceSessions();
            toast(`${n} andere Geräte abgemeldet`, "success");
            await refreshDeviceSessions();
        } catch (e) {
            toast(`Abmelden: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setRevokeOtherBusy(false);
        }
    };

    const cardReaderRemote = portalIntegrations?.card_reader as { status?: string; detail?: string } | undefined;
    const cardReaderPill = useMemo(() => portalIntegrationPill(cardReaderRemote?.status), [cardReaderRemote?.status]);

    return (
        <>
            <section className="settings-subcard">
                <div className="card-head">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                        <div>
                            <div className="card-title">Sicherheit</div>
                            <div className="card-sub">DSGVO-Status · Audit-Protokolle · Zugriffskontrolle</div>
                        </div>
                        <span className="settings-pill-green">Konform</span>
                    </div>
                </div>
                <div className="settings-row">
                    <div>
                        <b>Zwei-Faktor-Authentifizierung (2FA)</b>
                        <div className="card-sub">
                            Per Authenticator-App · Umstellung mit IT abstimmen
                            {portalFlags?.two_factor_auth_enforced === true
                                ? " — Hersteller-Richtlinie: 2FA wird bei voller Portal-Anbindung empfohlen."
                                : ""}
                        </div>
                    </div>
                    <SettingsSwitch
                        ariaLabel="2FA"
                        checked={security.twoFactorEnabled !== false}
                        onChange={() =>
                            onPersistClient((c) => {
                                const s = c.security ?? DEFAULT_CLIENT_SETTINGS.security!;
                                const cur = s.twoFactorEnabled !== false;
                                return mergeClientSettingsPatch(c, { security: { ...s, twoFactorEnabled: !cur } });
                            })
                        }
                    />
                </div>
                <div className="settings-row">
                    <div>
                        <b>Auto-Sperre nach Inaktivität</b>
                        <div className="card-sub">
                            {(security.idleLogoutMinutes ?? 0) > 0
                                ? `Nach ${security.idleLogoutMinutes} Minuten — sperrt Arbeitsplatz & Akten`
                                : "Aus — bei Bedarf Minuten wählen (Abschnitt System)"}
                        </div>
                    </div>
                    <SettingsSwitch
                        ariaLabel="Auto-Sperre"
                        checked={(security.idleLogoutMinutes ?? 0) > 0}
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
                <div className="settings-row">
                    <div>
                        <b>HBA / eGK Kartenleser</b>
                        <div className="card-sub">
                            {cardReaderRemote?.detail?.trim()
                                ? cardReaderRemote.detail
                                : "Orga 6141 · Terminal-ID 8800-4421 (Beispiel — Status vom Hersteller-Portal, wenn konfiguriert)"}
                        </div>
                    </div>
                    <span className={cardReaderPill.className}>{cardReaderPill.label}</span>
                </div>
                <div className="settings-row">
                    <div>
                        <b>Audit-Protokoll</b>
                        <div className="card-sub">
                            {healthLast
                                ? `Letzte 90 Tage · ${healthLast.audit_chain_ok ? "Kette intakt" : "Prüfung ausstehend"}`
                                : "Letzte 90 Tage · Ereignisse"}
                        </div>
                    </div>
                    <Link to="/audit" className="btn btn-subtle" style={{ whiteSpace: "nowrap" }}>
                        Anzeigen
                    </Link>
                </div>
                <div className="settings-row">
                    <div>
                        <b>Datenexport (DSGVO)</b>
                        <div className="card-sub">Patientendaten auf Anfrage exportieren</div>
                    </div>
                    <Link to="/datenschutz" className="btn btn-subtle" style={{ whiteSpace: "nowrap" }}>
                        Anfordern
                    </Link>
                </div>
            </section>
            <section className="settings-subcard settings-team-card">
                <div className="card-head">
                    <div>
                        <div className="card-title">Team-Sitzungen</div>
                        <div className="card-sub">
                            {deviceSessionsBusy
                                ? "Geräte werden geladen …"
                                : "Aktive Anmeldungen dieses Benutzers (SQLite `device_session`)"}
                        </div>
                    </div>
                </div>
                {deviceSessions.length === 0 && !deviceSessionsBusy ? (
                    <div className="card-pad" style={{ color: "var(--fg-3)", fontSize: 13 }}>
                        Keine Einträge — nach erneutem Anmelden erscheint dieses Gerät hier, sobald die Datenbank die
                        Sitzung speichert.
                    </div>
                ) : null}
                {deviceSessions.map((row) => (
                    <div key={row.id} className="settings-row" style={{ alignItems: "flex-start" }}>
                        <span className={`settings-team-lock${row.is_current ? "" : " is-muted"}`} aria-hidden>
                            <ShieldIcon size={18} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <b>{(row.device_label ?? "").trim() || "Gerät"}</b>
                                {row.is_current ? <span className="settings-pill-green">Diese Sitzung</span> : null}
                            </div>
                            <div className="settings-team-meta">
                                {(row.user_agent ?? "").slice(0, 120) || "—"} · zuletzt {row.last_seen_at}
                            </div>
                        </div>
                    </div>
                ))}
                <div className="settings-row" style={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div className="settings-team-meta" style={{ flex: "1 1 200px" }}>
                        Andere Geräte dieses Kontos abmelden (Passwort bleibt gültig).
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        loading={revokeOtherBusy}
                        disabled={revokeOtherBusy || deviceSessionsBusy}
                        onClick={() => void revokeOtherDeviceSessions()}
                    >
                        Andere abmelden
                    </Button>
                </div>
            </section>
        </>
    );
}
