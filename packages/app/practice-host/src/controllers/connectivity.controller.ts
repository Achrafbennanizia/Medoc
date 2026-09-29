/**
 * Topbar connectivity — probe the practice backend the UI actually talks to.
 *
 * - Desktop / serverless: Tauri IPC (`get_session`).
 * - LAN client: HTTPS to the configured LAN host (`/health` or `/api/v1/ping`).
 * - Replica: also probes the master base URL when set.
 */
import { isLanClientActive, loadLanClientConfig } from "@/systems/lan/lib/lan-client-config";
import { practiceSystem } from "../adapters/practice-transport";
import { syncGetStatus } from "./sync.controller";

const PING_TIMEOUT_MS = 4_000;

async function fetchOk(url: string): Promise<boolean> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
    try {
        const res = await fetch(url, { method: "GET", signal: ctrl.signal, cache: "no-store" });
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
        if (replica && !(await httpReachable(master))) {
            return false;
        }
    } catch {
        /* LAN HTTP adapter has no sync_get_status; local/LAN probe already ran. */
    }

    return true;
}
