import { tauriInvoke } from "@/services/tauri.service";

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
};

export type LanDiscoveryHitDto = {
    fromAddr: string;
    httpPort: number;
    instanceId: string;
    label: string;
    version: string;
};

export const lanServerGetConfig = () => tauriInvoke<LanServerConfigV1>("lan_server_get_config");

export const lanServerSetConfig = (config: LanServerConfigV1) =>
    tauriInvoke<void>("lan_server_set_config", { config });

export const lanServerStatus = () => tauriInvoke<LanServerStatusPayload>("lan_server_status");

export const lanServerStart = () => tauriInvoke<LanServerStatusPayload>("lan_server_start");

export const lanServerStop = () => tauriInvoke<void>("lan_server_stop");

export const lanServerScan = (labelContains?: string) =>
    tauriInvoke<LanDiscoveryHitDto[]>("lan_server_scan", { labelContains });
