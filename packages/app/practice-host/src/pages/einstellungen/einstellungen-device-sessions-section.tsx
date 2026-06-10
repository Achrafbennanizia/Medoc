import { useCallback, useEffect, useState } from "react";
import {
    investigateMyDeviceSession,
    listMyDeviceSessions,
    revokeMyDeviceSession,
    revokeMyOtherDeviceSessions,
    setMyDeviceSessionTrusted,
    type DeviceSessionInvestigation,
    type DeviceSessionRow,
} from "@/systems/practice-host/controllers/device-session.controller";
import { ShieldIcon } from "@/lib/icons";
import { Button } from "@/views/components/ui/button";
import { ConfirmDialog, Dialog } from "@/views/components/ui/dialog";
import { useToastStore } from "@/views/components/ui/toast-store";

/** Eigene Gerätesitzungen — Einstellungen → Sicherheit. */
export function EinstellungenDeviceSessionsSection() {
    const toast = useToastStore((s) => s.add);
    const [deviceSessions, setDeviceSessions] = useState<DeviceSessionRow[]>([]);
    const [deviceSessionsBusy, setDeviceSessionsBusy] = useState(false);
    const [revokeOtherBusy, setRevokeOtherBusy] = useState(false);
    const [investigateBusyId, setInvestigateBusyId] = useState<string | null>(null);
    const [revokeBusyId, setRevokeBusyId] = useState<string | null>(null);
    const [trustBusyId, setTrustBusyId] = useState<string | null>(null);
    const [investigation, setInvestigation] = useState<DeviceSessionInvestigation | null>(null);
    const [revokeTarget, setRevokeTarget] = useState<DeviceSessionRow | null>(null);

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

    useEffect(() => {
        void refreshDeviceSessions();
    }, [refreshDeviceSessions]);

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

    const openInvestigation = async (row: DeviceSessionRow) => {
        setInvestigateBusyId(row.id);
        try {
            const report = await investigateMyDeviceSession(row.id);
            setInvestigation(report);
        } catch (e) {
            toast(`Untersuchung: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setInvestigateBusyId(null);
        }
    };

    const setTrusted = async (row: DeviceSessionRow, trusted: boolean) => {
        setTrustBusyId(row.id);
        try {
            const updated = await setMyDeviceSessionTrusted(row.id, trusted);
            toast(trusted ? "Gerät als vertrauenswürdig markiert" : "Vertrauen widerrufen", "success");
            setDeviceSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)));
            if (investigation?.session.id === updated.id) {
                setInvestigation((prev) => (prev ? { ...prev, session: updated } : prev));
            }
        } catch (e) {
            toast(`Vertrauen: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setTrustBusyId(null);
        }
    };

    const confirmRevokeOne = async () => {
        if (!revokeTarget) return;
        setRevokeBusyId(revokeTarget.id);
        try {
            await revokeMyDeviceSession(revokeTarget.id);
            toast("Gerät abgemeldet", "success");
            setRevokeTarget(null);
            if (investigation?.session.id === revokeTarget.id) {
                setInvestigation(null);
            }
            await refreshDeviceSessions();
        } catch (e) {
            toast(`Abmelden: ${e instanceof Error ? e.message : String(e)}`, "error");
        } finally {
            setRevokeBusyId(null);
        }
    };

    const otherCount = deviceSessions.filter((r) => !r.is_current).length;
    const suspectedCount = deviceSessions.filter((r) => r.is_suspected).length;

    return (
        <section className="settings-subcard settings-device-sessions-card">
            <div className="card-head settings-device-sessions-card-head">
                <div className="settings-device-sessions-head">
                    <div className="settings-device-sessions-head-copy">
                        <div className="card-title">Gerätesitzungen</div>
                        <div className="card-sub">
                            {deviceSessionsBusy
                                ? "Geräte werden geladen …"
                                : "Aktive Anmeldungen dieses Benutzerkontos"}
                        </div>
                    </div>
                    {!deviceSessionsBusy ? (
                        <span className="settings-device-sessions-count settings-pill-blue">
                            {deviceSessions.length} aktiv
                        </span>
                    ) : null}
                </div>
            </div>

            {suspectedCount > 0 && !deviceSessionsBusy ? (
                <div className="settings-device-sessions-alert" role="status">
                    {suspectedCount} verdächtige Sitzung{suspectedCount === 1 ? "" : "en"} — bitte prüfen und ggf. abmelden.
                </div>
            ) : null}

            {deviceSessions.length === 0 && !deviceSessionsBusy ? (
                <div className="settings-device-sessions-empty">
                    Keine Einträge — nach erneutem Anmelden erscheint dieses Gerät hier.
                </div>
            ) : (
                <ul className="settings-device-sessions-list">
                    {deviceSessions.map((row) => (
                        <li
                            key={row.id}
                            className={`settings-device-session-item${row.is_suspected ? " is-suspected" : ""}${row.is_trusted ? " is-trusted" : ""}`}
                        >
                            <span
                                className={`settings-device-session-icon${row.is_current ? " is-current" : row.is_trusted ? " is-trusted" : row.is_suspected ? " is-suspected" : ""}`}
                                aria-hidden
                            >
                                <ShieldIcon size={18} />
                            </span>
                            <div className="settings-device-session-body">
                                <div className="settings-device-session-title-row">
                                    <b>{(row.device_label ?? "").trim() || "Gerät"}</b>
                                    {row.is_current ? (
                                        <span className="settings-pill-green">Diese Sitzung</span>
                                    ) : row.is_trusted ? (
                                        <span className="settings-pill-trusted">Vertrauenswürdig</span>
                                    ) : row.is_suspected ? (
                                        <span className="settings-pill-orange">Verdächtig</span>
                                    ) : null}
                                </div>
                                <div className="settings-device-session-meta">
                                    {(row.user_agent ?? "").slice(0, 120) || "—"}
                                </div>
                                <div className="settings-device-session-meta">
                                    Zuletzt aktiv: {row.last_seen_at}
                                    {row.trusted_at ? ` · Vertraut seit ${row.trusted_at}` : ""}
                                </div>
                                {row.is_suspected && row.suspected_reasons.length > 0 ? (
                                    <ul className="settings-device-session-reasons">
                                        {row.suspected_reasons.map((reason) => (
                                            <li key={reason}>{reason}</li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                            {!row.is_current ? (
                                <div className="settings-device-session-actions">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        loading={investigateBusyId === row.id}
                                        disabled={investigateBusyId != null || revokeBusyId != null || trustBusyId != null}
                                        onClick={() => void openInvestigation(row)}
                                    >
                                        Untersuchen
                                    </Button>
                                    {row.is_trusted ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            loading={trustBusyId === row.id}
                                            disabled={investigateBusyId != null || revokeBusyId != null || trustBusyId != null}
                                            onClick={() => void setTrusted(row, false)}
                                        >
                                            Vertrauen widerrufen
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="primary"
                                            loading={trustBusyId === row.id}
                                            disabled={investigateBusyId != null || revokeBusyId != null || trustBusyId != null}
                                            onClick={() => void setTrusted(row, true)}
                                        >
                                            Vertrauen
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={row.is_suspected ? "danger" : "ghost"}
                                        loading={revokeBusyId === row.id}
                                        disabled={investigateBusyId != null || revokeBusyId != null || trustBusyId != null}
                                        onClick={() => setRevokeTarget(row)}
                                    >
                                        Abmelden
                                    </Button>
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}

            <div className="settings-device-sessions-foot">
                <p className="settings-device-sessions-foot-hint">
                    Andere Geräte dieses Kontos abmelden — Ihr Passwort bleibt gültig.
                </p>
                <Button
                    type="button"
                    variant="secondary"
                    loading={revokeOtherBusy}
                    disabled={revokeOtherBusy || deviceSessionsBusy || otherCount === 0}
                    onClick={() => void revokeOtherDeviceSessions()}
                >
                    {otherCount > 0 ? `${otherCount} andere abmelden` : "Keine anderen Geräte"}
                </Button>
            </div>

            <Dialog
                open={investigation != null}
                onClose={() => setInvestigation(null)}
                title="Gerätesitzung untersuchen"
                className="settings-device-session-investigate-dialog"
                footer={
                    investigation && !investigation.session.is_current ? (
                        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {investigation.session.is_trusted ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    loading={trustBusyId === investigation.session.id}
                                    onClick={() => void setTrusted(investigation.session, false)}
                                >
                                    Vertrauen widerrufen
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="primary"
                                    loading={trustBusyId === investigation.session.id}
                                    onClick={() => void setTrusted(investigation.session, true)}
                                >
                                    Vertrauen
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="danger"
                                loading={revokeBusyId === investigation.session.id}
                                onClick={() => setRevokeTarget(investigation.session)}
                            >
                                Gerät abmelden
                            </Button>
                        </div>
                    ) : null
                }
            >
                {investigation ? (
                    <div className="settings-device-session-investigate">
                        <dl className="settings-device-session-investigate-grid">
                            <div>
                                <dt>Gerät</dt>
                                <dd>{investigation.session.device_label}</dd>
                            </div>
                            <div>
                                <dt>Erstellt</dt>
                                <dd>{investigation.session.created_at}</dd>
                            </div>
                            <div>
                                <dt>Zuletzt aktiv</dt>
                                <dd>{investigation.session.last_seen_at}</dd>
                            </div>
                            <div>
                                <dt>Aktive Sitzungen gesamt</dt>
                                <dd>{investigation.active_session_count}</dd>
                            </div>
                            <div>
                                <dt>Gleicher Gerätename</dt>
                                <dd>{investigation.same_device_label_count}</dd>
                            </div>
                            <div>
                                <dt>Vertrauensstatus</dt>
                                <dd>
                                    {investigation.session.is_trusted
                                        ? `Vertrauenswürdig${investigation.session.trusted_at ? ` (seit ${investigation.session.trusted_at})` : ""}`
                                        : investigation.session.is_suspected
                                          ? "Verdächtig"
                                          : "Ungeprüft"}
                                </dd>
                            </div>
                        </dl>
                        <div>
                            <p className="settings-device-session-investigate-label">User-Agent</p>
                            <pre className="settings-device-session-investigate-ua">
                                {investigation.session.user_agent || "—"}
                            </pre>
                        </div>
                        {investigation.session.suspected_reasons.length > 0 ? (
                            <div>
                                <p className="settings-device-session-investigate-label">Risikoindikatoren</p>
                                <ul className="settings-device-session-reasons">
                                    {investigation.session.suspected_reasons.map((r) => (
                                        <li key={r}>{r}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {investigation.recent_logins.length > 0 ? (
                            <div>
                                <p className="settings-device-session-investigate-label">Letzte Anmeldeereignisse</p>
                                <ul className="settings-device-session-audit-list">
                                    {investigation.recent_logins.map((entry) => (
                                        <li key={entry.id}>
                                            <span className="settings-device-session-audit-action">{entry.action}</span>
                                            <span>{entry.created_at}</span>
                                            {entry.details ? (
                                                <span className="settings-device-session-audit-details">{entry.details}</span>
                                            ) : null}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </Dialog>

            <ConfirmDialog
                open={revokeTarget != null}
                onClose={() => setRevokeTarget(null)}
                onConfirm={() => void confirmRevokeOne()}
                title="Gerät abmelden?"
                message={
                    revokeTarget
                        ? `„${revokeTarget.device_label}“ wird abgemeldet. Die Sitzung kann sich nicht mehr mit dem bestehenden Token anmelden.`
                        : ""
                }
                confirmLabel="Abmelden"
                danger
                loading={revokeBusyId != null}
            />
        </section>
    );
}
