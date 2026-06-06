/**
 * Practice deployment topology — how this installation reaches data.
 *
 * | Mode | Backend | Typical use |
 * |------|---------|-------------|
 * | practice_desktop | Tauri IPC + local SQLite | Admin workstation; optional embedded LAN on same machine |
 * | lan_client | HTTPS → remote medoc-server | Tablet/browser on LAN without local DB |
 * | serverless_peer | Tauri IPC + local SQLite + peer sync | Satellite device; queues offline, syncs to master |
 */

export type DeploymentMode = "practice_desktop" | "lan_client" | "serverless_peer";
export type DeviceRole = "MASTER" | "REPLICA";

export type SyncDeploymentConfigV1 = {
    schemaVersion: 1;
    mode: DeploymentMode;
    role: DeviceRole;
    masterBaseUrl: string;
    masterCertSha256: string;
    /** @deprecated Replaced by `activationToken` for new replicas. Kept for backwards-compat with JWT-paired devices. */
    masterAccessToken: string;
    deviceLabel: string;
    /** Ed25519-signed activation token issued by master after accepting pairing. */
    activationToken: string;
    /** Master device Ed25519 public key (base64-no-pad). */
    masterPubkey: string;
    /** Master's device id. */
    masterDeviceId: string;
    /** Pairing request id (set while a request is in flight). */
    pairingRequestId: string;
    /** BEST-EFFORT slave-to-slave mesh sync (disabled by default). */
    unstableMesh: boolean;
};

export const DEFAULT_SYNC_DEPLOYMENT: SyncDeploymentConfigV1 = {
    schemaVersion: 1,
    mode: "practice_desktop",
    role: "MASTER",
    masterBaseUrl: "",
    masterCertSha256: "",
    masterAccessToken: "",
    deviceLabel: "",
    activationToken: "",
    masterPubkey: "",
    masterDeviceId: "",
    pairingRequestId: "",
    unstableMesh: false,
};

/** Co-located: desktop app + embedded LAN API on one machine (admin host). */
export function isCoLocatedHost(mode: DeploymentMode): boolean {
    return mode === "practice_desktop";
}

/** Thin client — no local clinical DB; talks to LAN server only. */
export function isLanClientOnly(mode: DeploymentMode): boolean {
    return mode === "lan_client";
}

/** Serverless peer — local DB, syncs to master without a dedicated medoc-server for this device. */
export function isServerlessPeer(mode: DeploymentMode): boolean {
    return mode === "serverless_peer";
}
