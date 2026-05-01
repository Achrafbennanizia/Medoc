import { tauriInvoke } from "@/services/tauri.service";
import type { SyncNativeMenuPayload } from "@/lib/native-go-menu";

/** Rebuilds the native menu bar (Gehe zu, Datei, Ansicht, Hilfe) from RBAC-aligned payload. */
export async function syncNativeMenu(payload: SyncNativeMenuPayload): Promise<void> {
    await tauriInvoke<void>("sync_native_menu", { payload });
}
