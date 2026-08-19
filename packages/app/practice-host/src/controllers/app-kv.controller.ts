import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

/** Whitelisted keys (mirror of `permission_for` in `app_kv_commands.rs`). */
export type AppKvKey =
    | "practice.work_hours.v1"
    | "practice.blockedTimes.v1"
    | "practice.preferences.v1"
    | "practice.preferences.v1"
    | "practice.preferences-appointment.v1"
    | "export.path.v1"
    | "export.formats.v1"
    | "practice.logo.v1"
    | "invoice.practice.v1"
    /** LAN host configuration (same key as backend `APP_KV_KEY`). */
    | "lan.server.config.v1";

export const getAppKv = (key: AppKvKey) =>
    practiceSystem.invoke<string | null>("get_app_kv", { key });

export const setAppKv = (key: AppKvKey, value: string) =>
    practiceSystem.invoke<void>("set_app_kv", { key, value });

export const deleteAppKv = (key: AppKvKey) =>
    practiceSystem.invoke<void>("delete_app_kv", { key });

/** Whitelisted dynamic keys (e.g. `appointment.draft.v1.{uuid}`) — policy in `app_kv_policy.rs`. */
export const getAppKvRaw = (key: string) =>
    practiceSystem.invoke<string | null>("get_app_kv", { key });

export const setAppKvRaw = (key: string, value: string) =>
    practiceSystem.invoke<void>("set_app_kv", { key, value });

export const deleteAppKvRaw = (key: string) =>
    practiceSystem.invoke<void>("delete_app_kv", { key });
