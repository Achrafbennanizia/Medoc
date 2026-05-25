/**
 * **Factory** — selects Practice Host transport (Tauri IPC vs LAN HTTPS).
 */
import { isLanClientActive } from "@/systems/lan/lib/lan-client-config";
import type { PracticeSystemPort } from "../ports/practice-system.port";
import { HttpPracticeAdapter } from "./http-practice.adapter";
import { TauriPracticeAdapter } from "./tauri-practice.adapter";

let cached: PracticeSystemPort | null = null;
let cachedLan = false;

export function createPracticeSystem(): PracticeSystemPort {
    const lan = isLanClientActive();
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
        return createPracticeSystem().invoke<T>(command, args);
    },
};

export function resetPracticeTransportCache(): void {
    cached = null;
}
