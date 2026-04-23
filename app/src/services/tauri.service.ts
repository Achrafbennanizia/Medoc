import { invoke } from "@tauri-apps/api/core";

// All Tauri IPC goes through here (single place to add logging/validation later)
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    return invoke<T>(cmd, args);
}
