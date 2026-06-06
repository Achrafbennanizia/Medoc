/**
 * Low-level Tauri IPC transport (shared infrastructure).
 * Delegates at call time so Vitest mocks on `@/services/tauri.service` reach all adapters.
 */
import { tauriInvoke as invokeFromService } from "@/services/tauri.service";

export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    return invokeFromService<T>(cmd, args);
}
