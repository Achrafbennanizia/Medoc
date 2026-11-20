import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { SyncNativeMenuPayload } from "@/lib/native-go-menu";

/** Rebuilds the native menu bar (Go to, File, View, Help) from RBAC-aligned payload. */
export async function syncNativeMenu(payload: SyncNativeMenuPayload): Promise<void> {
    await practiceSystem.invoke<void>("sync_native_menu", { payload });
}
