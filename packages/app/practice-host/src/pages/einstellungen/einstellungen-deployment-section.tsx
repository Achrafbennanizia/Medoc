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
import { EinstellungenPairingInbox } from "@/systems/practice-host/pages/einstellungen/einstellungen-pairing-inbox";
import {
    SYSTEM_LEGACY_DEPLOYMENT_MODES_ENABLED,
    SYSTEM_MESH_SYNC_ENABLED,
    SYSTEM_SERVERLESS_FOCUS_ENABLED,
} from "@/lib/settings-ui-flags";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { Input, Select } from "@/views/components/ui/input";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

const MODE_OPTIONS: { value: DeploymentMode; label: string; hint: string }[] = [
    {
        value: "practice_desktop",
        label: "Praxis-Desktop (eigenständig)",
        hint: "Lokale Datenbank auf diesem Gerät. Optional: LAN-Server auf demselben Rechner starten.",
    },
    {
        value: "lan_client",
        label: "LAN-Client (ohne lokale DB)",
        hint: "Verbindet sich nur mit einem entfernten medoc-server — z. B. Tablet im WLAN.",
    },
    {
        value: "serverless_peer",
        label: "Serverless-Peer (Offline-Sync)",
        hint: "Eigene Datenbank; synchronisiert direkt mit dem Master-Gerät im LAN.",
    },
];

const ROLE_OPTIONS: { value: DeviceRole; label: string; hint: string }[] = [
    {
        value: "MASTER",
        label: "Master (Hauptgerät)",
        hint: "Autoritative Praxis-Datenbank. Replicas koppeln sich über Pairing an dieses Gerät.",
    },
    {
        value: "REPLICA",
        label: "Replica (Zweitgerät)",
        hint: "Lokale DB mit Offline-Warteschlange; synchronisiert mit dem Master wenn erreichbar.",
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
    const [status, setStatus] = useState<LanServerStatusPayload | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        try {
            setStatus(await lanServerStatus());
        } catch (e) {
            toast(`LAN-Status: ${errorMessage(e)}`, "warning");
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
            toast("HTTPS-Server gestartet — Replicas können diesen Master finden.", "success");
        } catch (e) {
            toast(`Start: ${errorMessage(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    const stop = async () => {
        setBusy(true);
        try {
            await lanServerStop();
            await refresh();
            toast("HTTPS-Server gestoppt.", "info");
        } catch (e) {
            toast(`Stopp: ${errorMessage(e)}`, "error");
        } finally {
            setBusy(false);
        }
    };

    const running = status?.running ?? false;

    return (
        <div className="settings-serverless-lan">
            <div className="settings-row" style={{ borderTop: "1px solid var(--line)", paddingInline: 0, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <b>Master im LAN erreichbar machen</b>
                    <div className="card-sub">
                        {running
                            ? `HTTPS aktiv auf Port ${status?.httpPort ?? "—"}. Replicas scannen das LAN oder nutzen die URL unten.`
                            : "Starten Sie den eingebetteten HTTPS-Server, damit Replicas Pairing-Anfragen senden können."}
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
                            <b>TLS SHA-256 (für Replica-Abgleich):</b> <Mono>{status.tlsCertSha256}</Mono>
                        </div>
                    ) : null}
                </div>
                <div className="row" style={{ gap: 8, flexShrink: 0 }}>
                    {running ? (
                        <Button type="button" variant="secondary" size="sm" loading={busy} disabled={busy} onClick={() => void stop()}>
                            Stoppen
                        </Button>
                    ) : (
                        <Button type="button" size="sm" loading={busy} disabled={busy} onClick={() => void start()}>
                            HTTPS starten
                        </Button>
                    )}
                    <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}>
                        Aktualisieren
                    </Button>
                </div>
            </div>
        </div>
    );
}

export function EinstellungenDeploymentSection({
    embedded = false,
    showPairingInbox = false,
}: { embedded?: boolean; showPairingInbox?: boolean } = {}) {
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const canAckAuditBreak =
        session?.rolle != null &&
        (() => {
            const role = parseRole(session.rolle);
            return role != null && allowed("ops.audit_chain_ack", role, session.permission_overrides);
        })();
    const canRepairAuditChain =
        session?.rolle != null &&
        (() => {
            const role = parseRole(session.rolle);
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
            toast(`Verbindungsstatus: ${errorMessage(e)}`, "error");
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
                toast("Replica-Rolle gespeichert — Kopplungs-Assistent wird geöffnet …", "success");
                window.location.reload();
                return;
            }
            await reload();
            toast("Serverless-Einstellungen gespeichert.", "success");
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
                toast(`Sync teilweise fehlgeschlagen: ${report.error}${meshHint}`, "warning");
            } else {
                toast(
                    report.mesh && report.mesh.attempted > 0
                        ? `Synchronisation abgeschlossen (Mesh: ${report.mesh.succeeded}/${report.mesh.attempted}).`
                        : "Synchronisation abgeschlossen.",
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
    const visibleModes = SYSTEM_LEGACY_DEPLOYMENT_MODES_ENABLED
        ? MODE_OPTIONS
        : MODE_OPTIONS.filter((o) => o.value === "serverless_peer");

    const heading = (
        <>
            <div className="card-title" id={embedded ? undefined : "deployment-heading"}>
                {SYSTEM_SERVERLESS_FOCUS_ENABLED ? "Serverless-Verbindung" : "Bereitstellung & Sync"}
            </div>
            <div className="card-sub">
                {SYSTEM_SERVERLESS_FOCUS_ENABLED
                    ? "Master-Gerät und Replicas teilen sich eine Praxis-Datenbank über HTTPS im lokalen Netz. Pairing schützt die Verbindung per Ed25519-Aktivierungstoken."
                    : "Drei unabhängige Systeme: Desktop-App, LAN-Server (lokal/remote), Firmen-Server."}
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
                    title="Audit-Kette — Betrieb gesperrt"
                    subtitle={
                        <>
                            HTTPS-Server, Pairing und Speichern sind blockiert, bis die Audit-Störung quittiert wird
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
                                                                ? `Audit-Kette repariert (${result.deletedRows} Einträge entfernt).`
                                                                : "Audit-Kette ist intakt.",
                                                            "success",
                                                        );
                                                    } else {
                                                        toast(
                                                            "Audit-Kette konnte nicht vollständig repariert werden — bitte quittieren oder Support.",
                                                            "error",
                                                        );
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
                                        Kette reparieren
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
                                                    toast("Audit-Störung quittiert — Serverless-Funktionen wieder aktiv.", "success");
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
                                        Störung quittieren
                                    </Button>
                                ) : null}
                            </>
                        ) : (
                            <p className="card-sub" style={{ margin: 0 }}>
                                Bitte einen Arzt mit Administratorrechten die Störung in der Kopfleiste quittieren lassen.
                            </p>
                        )
                    }
                />
            ) : null}

            {!SYSTEM_SERVERLESS_FOCUS_ENABLED ? (
                <div className="settings-row" style={{ marginTop: embedded ? 0 : 12 }}>
                    <Select
                        id="deployment-mode"
                        label="Betriebsmodus"
                        value={cfg.mode}
                        options={visibleModes.map((o) => ({ value: o.value, label: o.label }))}
                        onChange={(e) => setCfg((c) => ({ ...c, mode: e.target.value as DeploymentMode }))}
                    />
                </div>
            ) : null}
            {!SYSTEM_SERVERLESS_FOCUS_ENABLED ? (
                <p className="card-sub" style={{ marginTop: 4 }}>
                    {MODE_OPTIONS.find((o) => o.value === cfg.mode)?.hint}
                </p>
            ) : null}

            <div className="settings-row" style={{ marginTop: SYSTEM_SERVERLESS_FOCUS_ENABLED ? 0 : 12 }}>
                <Select
                    id="deployment-role"
                    label="Geräterolle"
                    value={cfg.role}
                    options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(e) => setCfg((c) => ({ ...c, role: e.target.value as DeviceRole }))}
                />
            </div>
            <p className="card-sub" style={{ marginTop: 4 }}>
                {ROLE_OPTIONS.find((o) => o.value === cfg.role)?.hint}
            </p>

            <div className="settings-row" style={{ marginTop: 8 }}>
                <Input
                    id="device-label"
                    label="Gerätebezeichnung"
                    value={cfg.deviceLabel}
                    onChange={(e) => setCfg((c) => ({ ...c, deviceLabel: e.target.value }))}
                    placeholder={isMaster ? "z. B. Empfang MacBook (Master)" : "z. B. Behandlungszimmer iPad"}
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
                            <strong>Master-Fingerabdrücke</strong> (zum Abgleich auf Replicas)
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
                            <b>Verbindung zum Master</b>
                            <div className="card-sub">
                                {isPaired
                                    ? "Gekoppelt — Änderungen werden bei Erreichbarkeit synchronisiert."
                                    : "Noch nicht gekoppelt. Speichern Sie die Replica-Rolle und folgen Sie dem Kopplungs-Assistenten."}
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
                                        Jetzt synchronisieren
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
                                        Neu koppeln
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
                                    Replica koppeln
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
                            label="Master HTTPS-URL"
                            hint="Basis-URL des medoc-server, z. B. https://192.168.1.10:8787"
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
                            <span className="card-sub">Mesh-Sync zwischen Replicas (experimentell)</span>
                        </label>
                    ) : null}
                </>
            ) : null}

            {status ? (
                <div className="card-sub" style={{ marginTop: 12 }}>
                    Gerät-ID: <Mono>{status.localDeviceId}</Mono>
                    {status.pendingOutbox > 0 ? (
                        <>
                            {" "}
                            · <strong>{status.pendingOutbox}</strong> ausstehende Sync-Einträge
                        </>
                    ) : (
                        <> · Sync-Warteschlange leer</>
                    )}
                </div>
            ) : null}

            <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                <Button type="button" loading={busy} disabled={busy} onClick={() => void save()}>
                    Speichern
                </Button>
                {isReplica && isPaired ? (
                    <Button
                        type="button"
                        variant="secondary"
                        loading={syncBusy}
                        disabled={syncBusy}
                        onClick={() => void runSync()}
                    >
                        Jetzt synchronisieren
                    </Button>
                ) : null}
            </div>

            {showPairingInbox && isMaster ? (
                <div style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 4 }}>
                    <EinstellungenPairingInbox embedded />
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
