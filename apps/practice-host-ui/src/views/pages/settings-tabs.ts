import type { SettingsSectionId } from "@/lib/rbac";

/** `?tab=` value of each Settings section (links from other pages use these). */
export const TAB_QUERY: Record<SettingsSectionId, string> = {
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
    administration: "administration",
    allowances: "sharing",
};
