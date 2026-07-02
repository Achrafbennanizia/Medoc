import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

/** Whitelisted keys (mirror of `permission_for` in `app_kv_commands.rs`). */
export type AppKvKey =
    | "praxis.arbeitszeiten.v1"
    | "praxis.sperrzeiten.v1"
    | "praxis.preferences.v1"
    | "praxis.preferences-termin.v1"
    | "export.path.v1"
    | "export.formats.v1"
    | "praxis.logo.v1"
    | "invoice.praxis.v1"
    /** LAN host configuration (same key as backend `APP_KV_KEY`). */
    | "lan.server.config.v1";

export const getAppKv = (key: AppKvKey) =>
    practiceSystem.invoke<string | null>("get_app_kv", { key });

export const setAppKv = (key: AppKvKey, value: string) =>
    practiceSystem.invoke<void>("set_app_kv", { key, value });

export const deleteAppKv = (key: AppKvKey) =>
    practiceSystem.invoke<void>("delete_app_kv", { key });

/** Whitelisted dynamic keys (e.g. `termin.draft.v1.{uuid}`) — policy in `app_kv_policy.rs`. */
export const getAppKvRaw = (key: string) =>
    practiceSystem.invoke<string | null>("get_app_kv", { key });

export const setAppKvRaw = (key: string, value: string) =>
    practiceSystem.invoke<void>("set_app_kv", { key, value });

export const deleteAppKvRaw = (key: string) =>
    practiceSystem.invoke<void>("delete_app_kv", { key });
