import { useCallback, useEffect, useState } from "react";
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
    resetPracticeTransportCache,
    setDeploymentModeCache,
} from "@/systems/practice-host/adapters/practice-transport";
import { isLanClientActive, saveLanClientConfig } from "@/systems/lan/lib/lan-client-config";
import { Button } from "@/views/components/ui/button";
import { Input, Select } from "@/views/components/ui/input";
import { errorMessage } from "@/lib/utils";
import { useToastStore } from "@/views/components/ui/toast-store";

const MODE_OPTIONS: { value: DeploymentMode; label: string; hint: string }[] = [
    {
        value: "practice_desktop",
        label: "Praxis-Desktop (eigenständig)",
        hint: "Lokale Datenbank auf diesem Gerät. Optional: LAN-Server unten auf demselben Rechner starten.",
    },
    {
        value: "lan_client",
        label: "LAN-Client (ohne lokale DB)",
        hint: "Verbindet sich nur mit einem entfernten medoc-server — z. B. Tablet im WLAN.",
    },
    {
        value: "serverless_peer",
        label: "Serverless-Peer (Offline-Sync)",
        hint: "Eigene Datenbank; synchronisiert direkt mit dem Master-Gerät, ohne eigenen Server.",
    },
];

export function EinstellungenDeploymentSection() {
    const toast = useToastStore((s) => s.add);
    const [status, setStatus] = useState<SyncStatusSnapshot | null>(null);
    const [cfg, setCfg] = useState<SyncDeploymentConfigV1>(DEFAULT_SYNC_DEPLOYMENT);
    const [busy, setBusy] = useState(false);
    const [syncBusy, setSyncBusy] = useState(false);

    const reload = useCallback(async () => {
        try {
            const snap = await syncGetStatus();
            setStatus(snap);
            setCfg({
                schemaVersion: 1,
                mode: snap.deployment.mode as DeploymentMode,
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
        } catch (e) {
            toast(`Deployment-Status: ${errorMessage(e)}`, "error");
        }
    }, [toast]);

    useEffect(() => {
        void reload();
    }, [reload]);

    const save = async () => {
        setBusy(true);
        try {
            await syncSetDeployment(cfg);
            if (cfg.mode === "lan_client") {
                saveLanClientConfig({
                    schemaVersion: 1,
                    enabled: true,
                    baseUrl: cfg.masterBaseUrl.trim().replace(/\/$/, ""),
                    accessToken: cfg.masterAccessToken,
                });
            } else if (isLanClientActive()) {
                saveLanClientConfig({
                    schemaVersion: 1,
                    enabled: false,
                    baseUrl: "",
                    accessToken: "",
                });
            }
            setDeploymentModeCache(cfg.mode);
            resetPracticeTransportCache();
            await reload();
            toast("Bereitstellungsmodus gespeichert. Bei Transportwechsel ggf. neu anmelden.", "success");
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

    return (
        <section className="card-pad" aria-labelledby="deployment-heading">
            <div className="card-head">
                <div>
                    <h2 id="deployment-heading" className="card-title">
                        Bereitstellung &amp; Sync
                    </h2>
                    <p className="card-sub">
                        Drei unabhängige Systeme: Desktop-App, LAN-Server (lokal/remote), Firmen-Server.
                        Serverless-Peers halten Daten offline und gleichen mit dem Master ab.
                    </p>
                </div>
            </div>

            <div className="settings-row" style={{ marginTop: 12 }}>
                <Select
                    id="deployment-mode"
                    label="Betriebsmodus"
                    value={cfg.mode}
                    options={MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(e) => setCfg((c) => ({ ...c, mode: e.target.value as DeploymentMode }))}
                />
            </div>
            <p className="card-sub" style={{ marginTop: 4 }}>
                {MODE_OPTIONS.find((o) => o.value === cfg.mode)?.hint}
            </p>

            {cfg.mode === "serverless_peer" ? (
                <>
                    <div className="settings-row" style={{ marginTop: 12 }}>
                        <Select
                            id="deployment-role"
                            label="Geräterolle"
                            value={cfg.role}
                            options={[
                                { value: "MASTER", label: "Master (autoritativ)" },
                                { value: "REPLICA", label: "Replica (Offline-Warteschlange)" },
                            ]}
                            onChange={(e) => setCfg((c) => ({ ...c, role: e.target.value as DeviceRole }))}
                        />
                    </div>
                    {cfg.role === "REPLICA" ? (
                        <>
                            <div className="settings-row" style={{ marginTop: 8 }}>
                                <Input
                                    id="master-url"
                                    label="Master HTTPS-URL"
                                    value={cfg.masterBaseUrl}
                                    onChange={(e) => setCfg((c) => ({ ...c, masterBaseUrl: e.target.value }))}
                                    placeholder="https://192.168.1.10:8787"
                                />
                            </div>
                            <div className="settings-row" style={{ marginTop: 8 }}>
                                <Input
                                    id="master-token"
                                    label="Master-Zugangstoken (JWT nach Login)"
                                    type="password"
                                    value={cfg.masterAccessToken}
                                    onChange={(e) =>
                                        setCfg((c) => ({ ...c, masterAccessToken: e.target.value }))
                                    }
                                />
                            </div>
                            <div className="settings-row" style={{ marginTop: 8 }}>
                                <Input
                                    id="master-cert"
                                    label="TLS-Fingerabdruck (SHA-256, optional)"
                                    value={cfg.masterCertSha256}
                                    onChange={(e) =>
                                        setCfg((c) => ({ ...c, masterCertSha256: e.target.value }))
                                    }
                                />
                            </div>
                            {cfg.activationToken ? (
                                <div
                                    className="card-sub"
                                    style={{
                                        marginTop: 8,
                                        wordBreak: "break-all",
                                        background: "var(--surface-accent)",
                                        padding: 8,
                                        borderRadius: 6,
                                    }}
                                >
                                    <strong>Pairing aktiv.</strong> Master-DeviceID:{" "}
                                    <code>{cfg.masterDeviceId || "—"}</code>
                                    <br />
                                    Master-Pubkey: <code>{cfg.masterPubkey || "—"}</code>
                                    <br />
                                    Token: <code>{cfg.activationToken.slice(0, 32)}…</code>
                                </div>
                            ) : (
                                <p className="card-sub" style={{ marginTop: 8 }}>
                                    Noch kein Aktivierungstoken. Replica koppelt sich nach
                                    Speichern automatisch über die Pairing-Maske.
                                </p>
                            )}
                            <label
                                style={{
                                    display: "flex",
                                    gap: 6,
                                    alignItems: "center",
                                    marginTop: 8,
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={cfg.unstableMesh}
                                    onChange={(e) =>
                                        setCfg((c) => ({ ...c, unstableMesh: e.target.checked }))
                                    }
                                />
                                <span className="card-sub">
                                    Mesh-Sync zwischen Replicas aktivieren (experimentell)
                                </span>
                            </label>
                            <Button
                                type="button"
                                style={{ marginTop: 12 }}
                                loading={syncBusy}
                                disabled={syncBusy}
                                onClick={() => void runSync()}
                            >
                                Jetzt synchronisieren
                            </Button>
                        </>
                    ) : null}
                </>
            ) : null}

            <div className="settings-row" style={{ marginTop: 12 }}>
                <Input
                    id="device-label"
                    label="Gerätebezeichnung"
                    value={cfg.deviceLabel}
                    onChange={(e) => setCfg((c) => ({ ...c, deviceLabel: e.target.value }))}
                    placeholder="z. B. Empfang MacBook"
                />
            </div>

            {status ? (
                <div className="card-sub" style={{ marginTop: 12 }}>
                    Gerät-ID: <code>{status.localDeviceId}</code> · Seq: {status.localSeq} · Ausstehend:{" "}
                    {status.pendingOutbox}
                </div>
            ) : null}

            <div style={{ marginTop: 12 }}>
                <Button type="button" loading={busy} disabled={busy} onClick={() => void save()}>
                    Speichern
                </Button>
            </div>
        </section>
    );
}
