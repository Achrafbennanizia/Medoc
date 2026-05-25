import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";
import type {
    LanDiscoveryHitDto,
    LanServerConfigV1,
    LanServerStatusPayload,
} from "../controllers/lan-server.controller";
import type { LanSystemPort } from "../ports/lan-system.port";

export class TauriLanAdapter implements LanSystemPort {
    getConfig() {
        return tauriInvoke<LanServerConfigV1>("lan_server_get_config");
    }
    setConfig(config: LanServerConfigV1) {
        return tauriInvoke<void>("lan_server_set_config", { config });
    }
    status() {
        return tauriInvoke<LanServerStatusPayload>("lan_server_status");
    }
    start() {
        return tauriInvoke<LanServerStatusPayload>("lan_server_start");
    }
    stop() {
        return tauriInvoke<void>("lan_server_stop");
    }
    scan(labelContains?: string) {
        return tauriInvoke<LanDiscoveryHitDto[]>("lan_server_scan", { labelContains });
    }
}

export const lanSystem: LanSystemPort = new TauriLanAdapter();
