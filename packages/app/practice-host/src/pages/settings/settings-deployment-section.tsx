import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
    DEFAULT_SYNC_DEPLOYMENT,
    type DeploymentMode,
    type DeviceRole,
    type SyncDeploymentConfigV1,
} from "@/systems/practice-host/lib/deployment-config";
import {
    syncGetStatus,
    syncRunNow,
    syncSetDeployment,
    type SyncStatusSnapshot,
} from "@/systems/practice-host/controllers/sync.controller";
import {
    lanServerStart,
    lanServerStatus,
    lanServerStop,
    type LanServerStatusPayload,
} from "@/systems/practice-host/controllers/settings-page.controller";
import { pairingMasterInfo, type PairingMasterInfo } from "@/systems/practice-host/controllers/pairing.controller";
import {
    acknowledgeAuditChainBreak,
    getAuditChainStatus,
    repairAuditChain,
    type AuditChainStatus,
} from "@/systems/practice-host/controllers/audit-chain.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import {
    resetPracticeTransportCache,
    setDeploymentModeCache,
} from "@/systems/practice-host/adapters/practice-transport";
import { isLanClientActive, saveLanClientConfig } from "@/systems/lan/lib/lan-client-config";
import { SettingsPairingInbox } from "@/systems/practice-host/pages/settings/settings-pairing-inbox";
import {
    SYSTEM_LEGACY_DEPLOYMENT_MODES_ENABLED,
    SYSTEM_MESH_SYNC_ENABLED,
    SYSTEM_SERVERLESS_FOCUS_ENABLED,
} from "@/lib/settings-ui-flags";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { Input, Select } from "@/views/components/ui/input";
import { errorMessage } from "@/lib/utils";
import { useReplicaSyncStatusStore } from "@/models/store/replica-sync-status-store";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT, useTParams } from "@/lib/i18n";

const MODE_OPTIONS = (t: (key: string) => string): { value: DeploymentMode; label: string; hint: string }[] => [
    {
        value: "practice_desktop",
        label: t("settings.deployment.mode.practice_desktop"),
        hint: t("settings.deployment.mode.practice_desktop_hint"),
    },
    {
        value: "lan_client",
        label: t("settings.deployment.mode.lan_client"),
        hint: t("settings.deployment.mode.lan_client_hint"),
    },
    {
        value: "serverless_peer",
        label: t("settings.deployment.mode.serverless_peer"),
        hint: t("settings.deployment.mode.serverless_peer_hint"),
    },
];

const ROLE_OPTIONS = (t: (key: string) => string): { value: DeviceRole; label: string; hint: string }[] => [
    {
        value: "MASTER",
        label: t("settings.deployment.role.master"),
        hint: t("settings.deployment.role.master_hint"),
    },
    {
        value: "REPLICA",
        label: t("settings.deployment.role.replica"),
        hint: t("settings.deployment.role.replica_hint"),
    },
];

function Mono({ children }: { children: ReactNode }) {
    return (
        <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, wordBreak: "break-all" }}>
            {children}
        </code>
    );
}

function ServerlessMasterLanCompact() {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const [status, setStatus] = useState<LanServerStatusPayload | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        try {
            setStatus(await lanServerStatus());
        } catch (e) {
            toast(tp("settings.deployment.toast.lan_status", { message: errorMessage(e) }), "warning");
        }
    }, [toast]);

    useEffect(() => {
        void refresh();
        const id = window.setInterval(() => void refresh(), 8000);
        return () => window.clearInterval(id);
    }, [refresh]);

    const start = async () => {
        setBusy(true);
        try {
            setStatus(await lanServerStart());
            toast(t("settings.deployment.toast.https_started"), "success");
        } catch (e) {
            toast(tp("settings.deployment.toast.start_error", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    const stop = async () => {
        setBusy(true);
        try {
            await lanServerStop();
            await refresh();
            toast(t("settings.deployment.toast.https_stopped"), "info");
        } catch (e) {
            toast(tp("settings.deployment.toast.stop_error", { message: errorMessage(e) }), "error");
        } finally {
            setBusy(false);
        }
    };

    const running = status?.running ?? false;

    return (
        <div className="settings-serverless-lan">
            <div className="settings-row" style={{ borderTop: "1px solid var(--line)", paddingInline: 0, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{t("settings.deployment.lan_master_title")}</b>
                    <div className="card-sub">
                        {running
                            ? tp("settings.deployment.lan_running", { port: status?.httpPort ?? "—" })
                            : t("settings.deployment.lan_stopped")}
                    </div>
                    {running && status?.suggestedBaseUrls?.length ? (
                        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--fg-2)" }}>
                            {status.suggestedBaseUrls.slice(0, 4).map((u) => (
                                <li key={u}>
                                    <Mono>{u}</Mono>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    {running && status?.tlsCertSha256 ? (
                        <div className="card-sub" style={{ marginTop: 8 }}>
                            <b>{t("settings.deployment.tls_sha256")}</b> <Mono>{status.tlsCertSha256}</Mono>
                        </div>
                    ) : null}
                </div>
                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                    {running ? (
                        <Button type="button" variant="secondary" size="sm" loading={busy} disabled={busy} onClick={() => void stop()}>
                            {t("settings.deployment.https_stop")}
                        </Button>
                    ) : (
                        <Button type="button" size="sm" loading={busy} disabled={busy} onClick={() => void start()}>
                            {t("settings.deployment.https_start")}
                        </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}>
                        {t("common.refresh")}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function SettingsDeploymentSection({
    embedded = false,
    showPairingInbox = false,
}: { embedded?: boolean; showPairingInbox?: boolean } = {}) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const session = useAuthStore((s) => s.session);
    const canAckAuditBreak =
        session?.role != null &&
        (() => {
            const role = parseRole(session.role);
            return role != null && allowed("ops.audit_chain_ack", role, session.permission_overrides);
        })();
    const canRepairAuditChain =
        session?.role != null &&
        (() => {
            const role = parseRole(session.role);
            return role != null && allowed("ops.system", role, session.permission_overrides);
        })();
    const [status, setStatus] = useState<SyncStatusSnapshot | null>(null);
    const [auditChain, setAuditChain] = useState<AuditChainStatus | null>(null);
    const [auditAckBusy, setAuditAckBusy] = useState(false);
    const [auditRepairBusy, setAuditRepairBusy] = useState(false);
    const [cfg, setCfg] = useState<SyncDeploymentConfigV1>(DEFAULT_SYNC_DEPLOYMENT);
    const [masterInfo, setMasterInfo] = useState<PairingMasterInfo | null>(null);
    const [busy, setBusy] = useState(false);
    const [syncBusy, setSyncBusy] = useState(false);
    const lastSyncError = useReplicaSyncStatusStore((s) => s.lastError);
    const setLastSyncError = useReplicaSyncStatusStore((s) => s.setLastError);

    const reload = useCallback(async () => {
        try {
            const snap = await syncGetStatus();
            setStatus(snap);
            const mode = SYSTEM_SERVERLESS_FOCUS_ENABLED
                ? "serverless_peer"
                : (snap.deployment.mode as DeploymentMode);
            setCfg({
                schemaVersion: 1,
                mode,
                role: snap.deployment.role as DeviceRole,
                masterBaseUrl: snap.deployment.masterBaseUrl ?? "",
                masterCertSha256: snap.deployment.masterCertSha256 ?? "",
                masterAccessToken: snap.deployment.masterAccessToken ?? "",
                deviceLabel: snap.deployment.deviceLabel ?? "",
                activationToken: snap.deployment.activationToken ?? "",
                masterPubkey: snap.deployment.masterPubkey ?? "",
                masterDeviceId: snap.deployment.masterDeviceId ?? "",
                pairingRequestId: snap.deployment.pairingRequestId ?? "",
                unstableMesh: Boolean(snap.deployment.unstableMesh),
            });
            if (snap.deployment.role === "MASTER") {
                void pairingMasterInfo()
                    .then(setMasterInfo)
                    .catch(() => setMasterInfo(null));
            } else {
                setMasterInfo(null);
            }
        } catch (e) {
            toast(tp("settings.deployment.toast.connection_status", { message: errorMessage(e) }), "error");
        }
    }, [toast]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const loadAuditChain = useCallback(async () => {
        try {
            setAuditChain(await getAuditChainStatus());
        } catch {
            setAuditChain(null);
        }
    }, []);

    useEffect(() => {
        void loadAuditChain();
        const id = window.setInterval(() => void loadAuditChain(), 30_000);
        return () => window.clearInterval(id);
    }, [loadAuditChain]);

    const buildPayload = (draft: SyncDeploymentConfigV1): SyncDeploymentConfigV1 => ({
        ...draft,
        mode: SYSTEM_SERVERLESS_FOCUS_ENABLED ? "serverless_peer" : draft.mode,
        unstableMesh: SYSTEM_MESH_SYNC_ENABLED ? draft.unstableMesh : false,
    });

    const save = async (opts?: { startPairing?: boolean }) => {
        setBusy(true);
        try {
            const next = buildPayload(cfg);
            if (opts?.startPairing) {
                next.activationToken = "";
                next.masterAccessToken = "";
                next.masterPubkey = "";
                next.masterDeviceId = "";
                next.pairingRequestId = "";
            }
            await syncSetDeployment(next);
            if (next.mode === "lan_client") {
                saveLanClientConfig({
                    schemaVersion: 1,
                    enabled: true,
                    baseUrl: next.masterBaseUrl.trim().replace(/\/$/, ""),
                    accessToken: next.masterAccessToken,
                });
            } else if (isLanClientActive()) {
                saveLanClientConfig({
                    schemaVersion: 1,
                    enabled: false,
                    baseUrl: "",
                    accessToken: "",
                });
            }
            setDeploymentModeCache(next.mode);
            resetPracticeTransportCache();
            if (opts?.startPairing) {
                toast(t("settings.deployment.toast.replica_saved"), "success");
                window.location.reload();
                return;
            }
            await reload();
            toast(t("settings.deployment.toast.saved"), "success");
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const runSync = async () => {
        setSyncBusy(true);
        try {
            const report = await syncRunNow();
            const meshHint =
                report.mesh && report.mesh.errors.length > 0
                    ? ` Mesh: ${report.mesh.errors.join("; ")}`
                    : "";
            if (report.error) {
                setLastSyncError(report.error);
                toast(tp("settings.deployment.toast.sync_partial", { error: report.error, meshHint }), "warning");
            } else {
                setLastSyncError(null);
                toast(
                    report.mesh && report.mesh.attempted > 0
                        ? tp("settings.deployment.toast.sync_done_mesh", {
                              succeeded: report.mesh.succeeded,
                              attempted: report.mesh.attempted,
                          })
                        : t("settings.deployment.toast.sync_done"),
                    "success",
                );
            }
            await reload();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setSyncBusy(false);
        }
    };

    const isMaster = cfg.role === "MASTER";
    const isReplica = cfg.role === "REPLICA";
    const isPaired = Boolean(cfg.activationToken?.trim());
    const modeOptions = MODE_OPTIONS(t);
    const visibleModes = SYSTEM_LEGACY_DEPLOYMENT_MODES_ENABLED
        ? modeOptions
        : modeOptions.filter((o) => o.value === "serverless_peer");
    const roleOptions = ROLE_OPTIONS(t);

    const heading = (
        <>
            <div className="card-title" id={embedded ? undefined : "deployment-heading"}>
                {SYSTEM_SERVERLESS_FOCUS_ENABLED ? t("settings.deployment.title_serverless") : t("settings.deployment.title_classic")}
            </div>
            <div className="card-sub">
                {SYSTEM_SERVERLESS_FOCUS_ENABLED
                    ? t("settings.deployment.subtitle_serverless")
                    : t("settings.deployment.subtitle_classic")}
            </div>
        </>
    );

    const body = (
        <>
            {auditChain?.blocks_ops ? (
                <DismissibleNotice
                    variant="error"
                    role="alert"
                    closable={false}
                    className="settings-serverless-audit-block"
                    title={t("settings.deployment.audit_blocked_title")}
                    subtitle={
                        <>
                            {t("settings.deployment.audit_blocked")}
                            {auditChain.broken_at ? ` (Eintrag ${auditChain.broken_at.slice(0, 8)}…)` : ""}.
                        </>
                    }
                    actions={
                        canAckAuditBreak || canRepairAuditChain ? (
                            <>
                                {canRepairAuditChain ? (
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        loading={auditRepairBusy}
                                        disabled={auditRepairBusy || auditAckBusy}
                                        onClick={() =>
                                            void (async () => {
                                                setAuditRepairBusy(true);
                                                try {
                                                    const result = await repairAuditChain();
                                                    if (result.chainOk) {
                                                        toast(
                                                            result.deletedRows > 0
                                                                ? tp("settings.deployment.toast.audit_repaired", { count: result.deletedRows })
                                                                : t("settings.deployment.toast.audit_intact"),
                                                            "success",
                                                        );
                                                    } else {
                                                        toast(t("settings.deployment.toast.audit_repair_failed"), "error");
                                                    }
                                                    await loadAuditChain();
                                                    await reload();
                                                } catch (e) {
                                                    toast(errorMessage(e), "error");
                                                } finally {
                                                    setAuditRepairBusy(false);
                                                }
                                            })()
                                        }
                                    >
                                        {t("settings.deployment.repair_chain")}
                                    </Button>
                                ) : null}
                                {canAckAuditBreak ? (
                                    <Button
                                        type="button"
                                        variant="danger"
                                        size="sm"
                                        loading={auditAckBusy}
                                        disabled={auditAckBusy || auditRepairBusy}
                                        onClick={() =>
                                            void (async () => {
                                                setAuditAckBusy(true);
                                                try {
                                                    await acknowledgeAuditChainBreak();
                                                    toast(t("settings.deployment.toast.ack_audit"), "success");
                                                    await loadAuditChain();
                                                    await reload();
                                                } catch (e) {
                                                    toast(errorMessage(e), "error");
                                                } finally {
                                                    setAuditAckBusy(false);
                                                }
                                            })()
                                        }
                                    >
                                        {t("settings.deployment.ack_break")}
                                    </Button>
                                ) : null}
                            </>
                        ) : (
                            <p className="card-sub" style={{ margin: 0 }}>
                                {t("settings.deployment.ack_break_hint")}
                            </p>
                        )
                    }
                />
            ) : null}

            {!SYSTEM_SERVERLESS_FOCUS_ENABLED ? (
                <div className="settings-row" style={{ marginTop: embedded ? 0 : 12 }}>
                    <Select
                        id="deployment-mode"
                        label={t("settings.deployment.operation_mode")}
                        value={cfg.mode}
                        options={visibleModes.map((o) => ({ value: o.value, label: o.label }))}
                        onChange={(e) => setCfg((c) => ({ ...c, mode: e.target.value as DeploymentMode }))}
                    />
                </div>
            ) : null}
            {!SYSTEM_SERVERLESS_FOCUS_ENABLED ? (
                <p className="card-sub" style={{ marginTop: 4 }}>
                    {visibleModes.find((o) => o.value === cfg.mode)?.hint}
                </p>
            ) : null}

            <div className="settings-row" style={{ marginTop: SYSTEM_SERVERLESS_FOCUS_ENABLED ? 0 : 12 }}>
                <Select
                    id="deployment-role"
                    label={t("settings.deployment.device_role")}
                    value={cfg.role}
                    options={roleOptions.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(e) => setCfg((c) => ({ ...c, role: e.target.value as DeviceRole }))}
                />
            </div>
            <p className="card-sub" style={{ marginTop: 4 }}>
                {roleOptions.find((o) => o.value === cfg.role)?.hint}
            </p>

            <div className="settings-row" style={{ marginTop: 8 }}>
                <Input
                    id="device-label"
                    label={t("settings.deployment.device_label")}
                    value={cfg.deviceLabel}
                    onChange={(e) => setCfg((c) => ({ ...c, deviceLabel: e.target.value }))}
                    placeholder={isMaster ? "e.g. Reception MacBook (Master)" : "e.g. Treatment-room iPad"}
                />
            </div>

            {isMaster ? (
                <>
                    <ServerlessMasterLanCompact />
                    {masterInfo ? (
                        <div
                            className="card-sub"
                            style={{
                                marginTop: 8,
                                padding: 10,
                                borderRadius: 8,
                                background: "var(--surface-accent)",
                            }}
                        >
                            <strong>{t("settings.deployment.master_fingerprints")}</strong> {t("settings.deployment.master_fingerprints_hint")}
                            <br />
                            Device-ID: <Mono>{masterInfo.masterDeviceId}</Mono>
                            <br />
                            Pubkey: <Mono>{masterInfo.masterPubkey}</Mono>
                        </div>
                    ) : null}
                </>
            ) : null}

            {isReplica ? (
                <div className="settings-serverless-replica">
                    <div
                        className="settings-row"
                        style={{
                            borderTop: "1px solid var(--line)",
                            paddingInline: 0,
                            alignItems: "flex-start",
                        }}
                    >
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <b>{t("settings.deployment.master_connection")}</b>
                            <div className="card-sub">
                                {isPaired
                                    ? t("settings.deployment.replica_paired")
                                    : t("settings.deployment.replica_unpaired")}
                            </div>
                            {isPaired ? (
                                <>
                                    {cfg.masterBaseUrl ? (
                                        <div className="card-sub" style={{ marginTop: 6 }}>
                                            Master-URL: <Mono>{cfg.masterBaseUrl}</Mono>
                                        </div>
                                    ) : null}
                                    {cfg.masterDeviceId ? (
                                        <div className="card-sub" style={{ marginTop: 4 }}>
                                            Master-Device-ID: <Mono>{cfg.masterDeviceId}</Mono>
                                        </div>
                                    ) : null}
                                </>
                            ) : null}
                        </div>
                        <div className="col" style={{ gap: 8, alignItems: "flex-end" }}>
                            {isPaired ? (
                                <>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        loading={syncBusy}
                                        disabled={syncBusy}
                                        onClick={() => void runSync()}
                                    >
                                        {t("settings.deployment.sync_now")}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() =>
                                            void save({
                                                startPairing: true,
                                            })
                                        }
                                    >
                                        {t("settings.deployment.repair_pairing")}
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    type="button"
                                    size="sm"
                                    loading={busy}
                                    disabled={busy}
                                    onClick={() => void save({ startPairing: true })}
                                >
                                    {t("settings.deployment.pair_replica")}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {!SYSTEM_SERVERLESS_FOCUS_ENABLED && cfg.mode === "serverless_peer" && isReplica ? (
                <>
                    <div className="settings-row" style={{ marginTop: 8 }}>
                        <Input
                            id="master-url"
                            label={t("settings.deployment.master_url")}
                            hint={t("settings.deployment.master_url_hint")}
                            value={cfg.masterBaseUrl}
                            onChange={(e) => setCfg((c) => ({ ...c, masterBaseUrl: e.target.value }))}
                            placeholder="https://192.168.1.10:8787"
                        />
                    </div>
                    {SYSTEM_MESH_SYNC_ENABLED ? (
                        <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
                            <input
                                type="checkbox"
                                checked={cfg.unstableMesh}
                                onChange={(e) => setCfg((c) => ({ ...c, unstableMesh: e.target.checked }))}
                            />
                            <span className="card-sub">{t("settings.deployment.mesh_sync")}</span>
                        </label>
                    ) : null}
                </>
            ) : null}

            {status ? (
                <div className="card-sub" style={{ marginTop: 12 }}>
                    {t("settings.deployment.device_id")} <Mono>{status.localDeviceId}</Mono>
                    {status.pendingOutbox > 0 ? (
                        <>
                            {" "}
                            · <strong>{tp("settings.deployment.pending_sync_entries", { count: status.pendingOutbox })}</strong>
                        </>
                    ) : (
                        <> · {t("settings.deployment.sync_queue_empty")}</>
                    )}
                </div>
            ) : null}

            {isReplica && lastSyncError ? (
                <DismissibleNotice
                    variant="warning"
                    role="status"
                    closable={false}
                    className="settings-serverless-sync-error"
                    title={t("settings.deployment.last_sync_error_title")}
                    subtitle={lastSyncError}
                />
            ) : null}

            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                <Button type="button" loading={busy} disabled={busy} onClick={() => void save()}>
                    {t("common.save")}
                </Button>
                {isReplica && isPaired ? (
                    <Button
                        type="button"
                        variant="secondary"
                        loading={syncBusy}
                        disabled={syncBusy}
                        onClick={() => void runSync()}
                    >
                        {t("settings.deployment.sync_now")}
                    </Button>
                ) : null}
            </div>

            {showPairingInbox && isMaster ? (
                <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 4 }}>
                    <SettingsPairingInbox embedded />
                </div>
            ) : null}
        </>
    );

    if (embedded) {
        return (
            <div className="settings-system-block settings-system-block--deployment">
                <div className="settings-system-block__head">{heading}</div>
                <div className="settings-system-block__body">{body}</div>
            </div>
        );
    }

    return (
        <section className="card-pad" aria-labelledby="deployment-heading">
            <div className="card-head">{heading}</div>
            {body}
        </section>
    );
}
