/**
 * Browser-only practice transport — always uses LAN HTTPS (no Tauri).
 * Wired via Vite alias over `@/systems/practice-host/adapters/tauri-practice.adapter`.
 */
import { HttpPracticeAdapter } from "@medoc/system-practice/adapters/http-practice.adapter";
import { loadLanClientConfig } from "@/systems/lan/lib/lan-client-config";
import type { PracticeSystemPort } from "@/systems/practice-host/ports/practice-system.port";

function createAdapter(): HttpPracticeAdapter {
    const cfg = loadLanClientConfig();
    return new HttpPracticeAdapter(cfg, { allowMissingToken: true });
}

export const practiceSystem: PracticeSystemPort = {
    invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
        return createAdapter().invoke<T>(command, args);
    },
};

export function createPracticeSystem(): PracticeSystemPort {
    return practiceSystem;
}

export function resetPracticeTransportCache(): void {
    /* no-op — browser client re-reads localStorage each invoke */
}

export function setDeploymentModeCache(_mode: string): void {
    /* no-op */
}
