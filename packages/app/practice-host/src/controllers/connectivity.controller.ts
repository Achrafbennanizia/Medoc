/**
 * Topbar connectivity — probe the practice backend the UI actually talks to.
 *
 * - Desktop / serverless: Tauri IPC (`get_session`).
 * - LAN client: HTTPS to the configured LAN host (`/health` or `/api/v1/ping`).
 * - Replica: also probes the master base URL when set.
 */
import { isLanClientActive, loadLanClientConfig } from "@/systems/lan/lib/lan-client-config";
import { recordHostClockSample } from "@/lib/practice-clock";
import { practiceSystem } from "../adapters/practice-transport";
import { syncGetStatus, syncProbeMaster } from "./sync.controller";

const PING_TIMEOUT_MS = 4_000;

/**
 * GET a health endpoint. When the host includes `server_time` (UTC RFC 3339) the sample is fed to the
 * practice clock so every LAN client shows the host's time, not its own drifting OS clock.
 */
async function fetchOk(url: string): Promise<boolean> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
    const sentAt = Date.now();
    try {
        const res = await fetch(url, { method: "GET", signal: ctrl.signal, cache: "no-store" });
        const receivedAt = Date.now();
        if (res.ok) {
            try {
                const body = (await res.clone().json()) as { server_time?: unknown };
                if (typeof body.server_time === "string") {
                    recordHostClockSample(body.server_time, sentAt, receivedAt);
                }
            } catch {
                /* older host without JSON body / server_time */
            }
        }
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

export async function httpReachable(baseUrl: string): Promise<boolean> {
    const base = baseUrl.trim().replace(/\/$/, "");
    if (!base) return false;
    return (await fetchOk(`${base}/health`)) || (await fetchOk(`${base}/api/v1/ping`));
}

export async function probeBackgroundServers(): Promise<boolean> {
    const lanCfg = loadLanClientConfig();
    const lan = isLanClientActive(lanCfg);

    if (lan && typeof navigator !== "undefined" && navigator.onLine === false) {
        return false;
    }

    try {
        await practiceSystem.invoke("get_session");
    } catch {
        return false;
    }

    if (lan && !(await httpReachable(lanCfg.baseUrl))) {
        return false;
    }

    try {
        const snap = await syncGetStatus();
        const master = snap.deployment.masterBaseUrl?.trim() ?? "";
        const replica =
            snap.deployment.mode === "serverless_peer" && snap.deployment.role === "REPLICA" && master.length > 0;
        if (__CAP_NET__ && replica) {
            return syncProbeMaster();
        }
    } catch {
        /* LAN HTTP adapter has no sync_get_status; local/LAN probe already ran. */
    }

    return true;
}
