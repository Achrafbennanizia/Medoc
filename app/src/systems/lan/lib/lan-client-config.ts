/**
 * LAN client mode — connect UI to practice host over HTTPS instead of Tauri IPC.
 * Persisted in localStorage (device UX; not clinical data).
 */

export type LanClientConfigV1 = {
    schemaVersion: 1;
    enabled: boolean;
    /** e.g. https://192.168.1.10:8787 — no trailing slash */
    baseUrl: string;
    /** JWT from POST /api/v1/auth/login */
    accessToken: string;
};

const STORAGE_KEY = "medoc.lan.client.v1";

export const EMPTY_LAN_CLIENT_CONFIG: LanClientConfigV1 = {
    schemaVersion: 1,
    enabled: false,
    baseUrl: "",
    accessToken: "",
};

export function loadLanClientConfig(): LanClientConfigV1 {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...EMPTY_LAN_CLIENT_CONFIG };
        const parsed = JSON.parse(raw) as Partial<LanClientConfigV1>;
        if (parsed.schemaVersion !== 1) return { ...EMPTY_LAN_CLIENT_CONFIG };
        return {
            schemaVersion: 1,
            enabled: Boolean(parsed.enabled),
            baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl.trim().replace(/\/$/, "") : "",
            accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken.trim() : "",
        };
    } catch {
        return { ...EMPTY_LAN_CLIENT_CONFIG };
    }
}

export function saveLanClientConfig(cfg: LanClientConfigV1): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function isLanClientActive(cfg: LanClientConfigV1 = loadLanClientConfig()): boolean {
    return cfg.enabled && cfg.baseUrl.length > 0 && cfg.accessToken.length > 0;
}
