/**
 * **Factory** — selects Practice Host transport (Tauri IPC vs LAN HTTPS).
 *
 * - `practice_desktop` / `serverless_peer` → local SQLite via Tauri IPC
 * - `lan_client` → remote `medoc-server` over HTTPS (no local DB)
 */
import { isLanClientActive } from "@/systems/lan/lib/lan-client-config";
import { isLanClientOnly } from "@/systems/practice-host/lib/deployment-config";
import type { PracticeSystemPort } from "../ports/practice-system.port";
import { HttpPracticeAdapter } from "./http-practice.adapter";
import { TauriPracticeAdapter } from "./tauri-practice.adapter";
import { hydrateOfflineWrites } from "./offline-write-queue";

const DEPLOYMENT_MODE_KEY = "medoc.deployment.mode.v1";

let cached: PracticeSystemPort | null = null;
let cachedLan = false;

function readDeploymentMode(): string {
    try {
        return localStorage.getItem(DEPLOYMENT_MODE_KEY) ?? "practice_desktop";
    } catch {
        return "practice_desktop";
    }
}

export function setDeploymentModeCache(mode: string): void {
    try {
        localStorage.setItem(DEPLOYMENT_MODE_KEY, mode);
    } catch {
        /* ignore */
    }
    resetPracticeTransportCache();
}

export function createPracticeSystem(): PracticeSystemPort {
    const mode = readDeploymentMode();
    const lan = isLanClientOnly(mode as "lan_client") || (mode !== "serverless_peer" && isLanClientActive());
    if (cached && cachedLan === lan) {
        return cached;
    }
    cachedLan = lan;
    cached = lan ? new HttpPracticeAdapter() : new TauriPracticeAdapter();
    if (cached instanceof HttpPracticeAdapter) {
        // Writes a crash or shutdown left in the cache file go out as soon as the main device answers.
        const adapter = cached;
        void hydrateOfflineWrites().then((n) => (n > 0 ? adapter.replayQueued() : 0));
    }
    return cached;
}

/** Facade — re-resolves when LAN client config changes (page reload recommended). */
export const practiceSystem: PracticeSystemPort = {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        return createPracticeSystem().invoke<T>(command, args);
    },
};

/** Back online: send the LAN client's queued offline writes right away. */
if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
        if (cached instanceof HttpPracticeAdapter) void cached.replayQueued();
    });
}

export function resetPracticeTransportCache(): void {
    cached = null;
}
