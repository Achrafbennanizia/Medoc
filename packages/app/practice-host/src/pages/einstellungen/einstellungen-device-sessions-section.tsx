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
import { useLocale, useT, useTParams } from "@/lib/i18n";
import { Button } from "@/views/components/ui/button";
import { ConfirmDialog, Dialog } from "@/views/components/ui/dialog";
import { useToastStore } from "@/views/components/ui/toast-store";

/** Own device sessions — Einstellungen → Sicherheit. */
export function EinstellungenDeviceSessionsSection() {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
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
            toast(tp("settings.device_sessions.toast.revoked_others", { count: n }), "success");
            await refreshDeviceSessions();
        } catch (e) {
            toast(tp("settings.device_sessions.toast.revoke_error", { message: e instanceof Error ? e.message : String(e) }), "error");
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
            toast(tp("settings.device_sessions.toast.investigate_error", { message: e instanceof Error ? e.message : String(e) }), "error");
        } finally {
            setInvestigateBusyId(null);
        }
    };

    const setTrusted = async (row: DeviceSessionRow, trusted: boolean) => {
        setTrustBusyId(row.id);
        try {
            const updated = await setMyDeviceSessionTrusted(row.id, trusted);
            toast(trusted ? t("settings.device_sessions.toast.trusted") : t("settings.device_sessions.toast.untrusted"), "success");
            setDeviceSessions((list) => list.map((s) => (s.id === updated.id ? updated : s)));
            if (investigation?.session.id === updated.id) {
                setInvestigation((prev) => (prev ? { ...prev, session: updated } : prev));
            }
        } catch (e) {
            toast(tp("settings.device_sessions.toast.trust_error", { message: e instanceof Error ? e.message : String(e) }), "error");
        } finally {
            setTrustBusyId(null);
        }
    };

    const confirmRevokeOne = async () => {
        if (!revokeTarget) return;
        setRevokeBusyId(revokeTarget.id);
        try {
            await revokeMyDeviceSession(revokeTarget.id);
            toast(t("settings.device_sessions.toast.revoked"), "success");
            setRevokeTarget(null);
            if (investigation?.session.id === revokeTarget.id) {
                setInvestigation(null);
            }
            await refreshDeviceSessions();
        } catch (e) {
            toast(tp("settings.device_sessions.toast.revoke_error", { message: e instanceof Error ? e.message : String(e) }), "error");
        } finally {
            setRevokeBusyId(null);
        }
    };

    const otherCount = deviceSessions.filter((r) => !r.is_current).length;
    const suspectedCount = deviceSessions.filter((r) => r.is_suspected).length;
    const suspectedSuffix = suspectedCount === 1 ? "" : locale === "de" ? "en" : "s";

    const trustStatusLabel = (session: DeviceSessionRow) => {
        if (session.is_trusted) {
            const since = session.trusted_at
                ? tp("settings.device_sessions.trust_status.trusted_since", { date: session.trusted_at })
                : "";
            return tp("settings.device_sessions.trust_status.trusted", { since });
        }
        if (session.is_suspected) return t("settings.device_sessions.trust_status.suspected");
        return t("settings.device_sessions.trust_status.unchecked");
    };

    return (
        <section className="settings-subcard settings-device-sessions-card">
            <div className="card-head settings-device-sessions-card-head">
                <div className="settings-device-sessions-head">
                    <div className="settings-device-sessions-head-copy">
                        <div className="card-title">{t("settings.device_sessions.title")}</div>
                        <div className="card-sub">
                            {deviceSessionsBusy
                                ? t("settings.device_sessions.loading")
                                : t("settings.device_sessions.subtitle")}
                        </div>
                    </div>
                    {!deviceSessionsBusy ? (
                        <span className="settings-device-sessions-count settings-pill-blue">
                            {tp("settings.device_sessions.count_active", { count: deviceSessions.length })}
                        </span>
                    ) : null}
                </div>
            </div>

            {suspectedCount > 0 && !deviceSessionsBusy ? (
                <div className="settings-device-sessions-alert" role="status">
                    {tp("settings.device_sessions.alert", { count: suspectedCount, suffix: suspectedSuffix })}
                </div>
            ) : null}

            {deviceSessions.length === 0 && !deviceSessionsBusy ? (
                <div className="settings-device-sessions-empty">
                    {t("settings.device_sessions.empty")}
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
                                    <b>{(row.device_label ?? "").trim() || t("settings.device_sessions.default_device")}</b>
                                    {row.is_current ? (
                                        <span className="settings-pill-green">{t("settings.device_sessions.pill.current")}</span>
                                    ) : row.is_trusted ? (
                                        <span className="settings-pill-trusted">{t("settings.device_sessions.pill.trusted")}</span>
                                    ) : row.is_suspected ? (
                                        <span className="settings-pill-orange">{t("settings.device_sessions.pill.suspected")}</span>
                                    ) : null}
                                </div>
                                <div className="settings-device-session-meta">
                                    {(row.user_agent ?? "").slice(0, 120) || "—"}
                                </div>
                                <div className="settings-device-session-meta">
                                    {tp("settings.device_sessions.last_active", { time: row.last_seen_at })}
                                    {row.trusted_at ? tp("settings.device_sessions.trusted_since", { time: row.trusted_at }) : ""}
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
                                        {t("settings.device_sessions.investigate")}
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
                                            {t("settings.device_sessions.revoke_trust")}
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
                                            {t("settings.device_sessions.trust")}
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
                                        {t("settings.device_sessions.sign_out")}
                                    </Button>
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}

            <div className="settings-device-sessions-foot">
                <p className="settings-device-sessions-foot-hint">
                    {t("settings.device_sessions.foot_hint")}
                </p>
                <Button
                    type="button"
                    variant="secondary"
                    loading={revokeOtherBusy}
                    disabled={revokeOtherBusy || deviceSessionsBusy || otherCount === 0}
                    onClick={() => void revokeOtherDeviceSessions()}
                >
                    {otherCount > 0
                        ? tp("settings.device_sessions.revoke_others", { count: otherCount })
                        : t("settings.device_sessions.no_others")}
                </Button>
            </div>

            <Dialog
                open={investigation != null}
                onClose={() => setInvestigation(null)}
                title={t("settings.device_sessions.dialog.title")}
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
                                    {t("settings.device_sessions.revoke_trust")}
                                </Button>
                            ) : (
                                <Button
                                    type="button"
                                    variant="primary"
                                    loading={trustBusyId === investigation.session.id}
                                    onClick={() => void setTrusted(investigation.session, true)}
                                >
                                    {t("settings.device_sessions.trust")}
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="danger"
                                loading={revokeBusyId === investigation.session.id}
                                onClick={() => setRevokeTarget(investigation.session)}
                            >
                                {t("settings.device_sessions.sign_out")}
                            </Button>
                        </div>
                    ) : null
                }
            >
                {investigation ? (
                    <div className="settings-device-session-investigate">
                        <dl className="settings-device-session-investigate-grid">
                            <div>
                                <dt>{t("settings.device_sessions.dialog.device")}</dt>
                                <dd>{investigation.session.device_label}</dd>
                            </div>
                            <div>
                                <dt>{t("settings.device_sessions.dialog.created")}</dt>
                                <dd>{investigation.session.created_at}</dd>
                            </div>
                            <div>
                                <dt>{t("settings.device_sessions.dialog.last_active")}</dt>
                                <dd>{investigation.session.last_seen_at}</dd>
                            </div>
                            <div>
                                <dt>{t("settings.device_sessions.dialog.total_sessions")}</dt>
                                <dd>{investigation.active_session_count}</dd>
                            </div>
                            <div>
                                <dt>{t("settings.device_sessions.dialog.same_device")}</dt>
                                <dd>{investigation.same_device_label_count}</dd>
                            </div>
                            <div>
                                <dt>{t("settings.device_sessions.dialog.trust_status")}</dt>
                                <dd>{trustStatusLabel(investigation.session)}</dd>
                            </div>
                        </dl>
                        <div>
                            <p className="settings-device-session-investigate-label">{t("settings.device_sessions.dialog.user_agent")}</p>
                            <pre className="settings-device-session-investigate-ua">
                                {investigation.session.user_agent || "—"}
                            </pre>
                        </div>
                        {investigation.session.suspected_reasons.length > 0 ? (
                            <div>
                                <p className="settings-device-session-investigate-label">{t("settings.device_sessions.dialog.risk_indicators")}</p>
                                <ul className="settings-device-session-reasons">
                                    {investigation.session.suspected_reasons.map((r) => (
                                        <li key={r}>{r}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : null}
                        {investigation.recent_logins.length > 0 ? (
                            <div>
                                <p className="settings-device-session-investigate-label">{t("settings.device_sessions.dialog.recent_logins")}</p>
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
                title={t("settings.device_sessions.confirm_revoke.title")}
                message={
                    revokeTarget
                        ? tp("settings.device_sessions.confirm_revoke.message", {
                              label: revokeTarget.device_label ?? t("settings.device_sessions.default_device"),
                          })
                        : ""
                }
                confirmLabel={t("settings.device_sessions.sign_out")}
                danger
                loading={revokeBusyId != null}
            />
        </section>
    );
}
