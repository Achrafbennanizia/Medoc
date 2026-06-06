export {
    loadLanClientConfig,
    saveLanClientConfig,
    isLanClientActive,
    EMPTY_LAN_CLIENT_CONFIG,
    type LanClientConfigV1,
} from "./lib/lan-client-config";

/** Tauri adapter is wired in `src/systems/lan/adapters/` (app shell). */
export { lanSystem } from "@/systems/lan/adapters/tauri-lan.adapter";
