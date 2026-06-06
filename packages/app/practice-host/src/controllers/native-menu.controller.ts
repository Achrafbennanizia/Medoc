import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { SyncNativeMenuPayload } from "@/lib/native-go-menu";

/** Rebuilds the native menu bar (Gehe zu, Datei, Ansicht, Hilfe) from RBAC-aligned payload. */
export async function syncNativeMenu(payload: SyncNativeMenuPayload): Promise<void> {
    await practiceSystem.invoke<void>("sync_native_menu", { payload });
}
