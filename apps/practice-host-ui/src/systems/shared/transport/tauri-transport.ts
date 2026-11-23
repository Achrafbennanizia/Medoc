/**
 * Low-level Tauri IPC transport (shared infrastructure).
 * Delegates at call time so Vitest mocks on `@/services/tauri.service` reach all adapters.
 */
import { tauriInvoke as invokeFromService } from "@/services/tauri.service";
import { reportApiFailure } from "@/lib/report-api-failure";

/** Every failed backend call is logged (client.log / errors.log), then rethrown unchanged. */
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    try {
        return await invokeFromService<T>(cmd, args);
    } catch (e) {
        reportApiFailure("ipc", cmd, e);
        throw e;
    }
}
