import type {
    LanDiscoveryHitDto,
    LanServerConfigV1,
    LanServerStatusPayload,
} from "../controllers/lan-server.controller";

/**
 * LAN system port — embedded server control + discovery (practice network).
 */
export interface LanSystemPort {
    getConfig(): Promise<LanServerConfigV1>;
    setConfig(config: LanServerConfigV1): Promise<void>;
    status(): Promise<LanServerStatusPayload>;
    start(): Promise<LanServerStatusPayload>;
    stop(): Promise<void>;
    scan(labelContains?: string): Promise<LanDiscoveryHitDto[]>;
}
