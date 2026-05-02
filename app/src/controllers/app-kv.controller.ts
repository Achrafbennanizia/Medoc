import { tauriInvoke } from "@/services/tauri.service";

/** Whitelisted keys (mirror of `permission_for` in `app_kv_commands.rs`). */
export type AppKvKey =
    | "praxis.arbeitszeiten.v1"
    | "praxis.sperrzeiten.v1"
    | "praxis.preferences.v1"
    | "praxis.preferences-termin.v1"
    | "export.path.v1"
    | "export.formats.v1"
    | "praxis.logo.v1";

export const getAppKv = (key: AppKvKey) =>
    tauriInvoke<string | null>("get_app_kv", { key });

export const setAppKv = (key: AppKvKey, value: string) =>
    tauriInvoke<void>("set_app_kv", { key, value });

export const deleteAppKv = (key: AppKvKey) =>
    tauriInvoke<void>("delete_app_kv", { key });
