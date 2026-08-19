/**
 * **Factory** — selects Practice Host transport (Tauri IPC vs LAN HTTPS).
 *
 * - `practice_desktop` / `serverless_peer` → local SQLite via Tauri IPC
 * - `lan_client` → remote `medoc-server` over HTTPS (no local DB)
 */
import { isLanClientActive } from "@/systems/lan/lib/lan-client-config";
import { isLanClientOnly } from "@/systems/practice-host/lib/deployment-config";
import { argsToIpc, resultFromIpc } from "@/lib/ipc-bridge";
import type { PracticeSystemPort } from "../ports/practice-system.port";
import { HttpPracticeAdapter } from "./http-practice.adapter";
import { TauriPracticeAdapter } from "./tauri-practice.adapter";

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
    return cached;
}

/** Facade — re-resolves when LAN client config changes (page reload recommended). */
export const practiceSystem: PracticeSystemPort = {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        return createPracticeSystem()
            .invoke<T>(command, argsToIpc(command, args))
            .then((row) => resultFromIpc(command, row));
    },
};

export function resetPracticeTransportCache(): void {
    cached = null;
}
