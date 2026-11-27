/** Settings section ids and their URL tab names. */
import type { SettingsSectionId } from "@/lib/rbac";

export const SETTINGS_BREADCRUMB_FALLBACK = "settings.breadcrumb_fallback";

export const PW_CHANGED_LS = "medoc-settings-pw-changed-at-ms";

export type SettingsSection = SettingsSectionId;

export const TAB_QUERY: Record<SettingsSection, string> = {
    practice: "practice",
    account: "account",
    notifications: "notifications",
    security: "security",
    license: "license",
    integrations: "integrations",
    migration: "migration",
    appearance: "appearance",
    system: "system",
    backups: "backups",
    about: "about",
};
