/**
 * LAN system — embedded HTTPS server + UDP discovery (practice network).
 * @see `app/src-tauri/src/systems/lan/`
 */
import { lanSystem } from "@/systems/lan/adapters/tauri-lan.adapter";

export type LanServerConfigV1 = {
    schemaVersion: number;
    bindAddr: string;
    httpPort: number;
    udpDiscoveryPort: number;
    instanceLabel: string;
    autoStartWithApp: boolean;
};

export type LanServerStatusPayload = {
    running: boolean;
    bindAddr: string | null;
    httpPort: number | null;
    discoveryPort: number | null;
    instanceLabel: string | null;
    suggestedBaseUrls: string[];
    tlsCertSha256: string | null;
};

export type LanDiscoveryHitDto = {
    fromAddr: string;
    httpPort: number;
    instanceId: string;
    label: string;
    version: string;
    tls: boolean;
    certSha256: string;
};

export const lanServerGetConfig = () => lanSystem.getConfig();
export const lanServerSetConfig = (config: LanServerConfigV1) => lanSystem.setConfig(config);
export const lanServerStatus = () => lanSystem.status();
export const lanServerStart = () => lanSystem.start();
export const lanServerStop = () => lanSystem.stop();
export const lanServerScan = (labelContains?: string) => lanSystem.scan(labelContains);
