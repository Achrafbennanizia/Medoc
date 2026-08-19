/**
 * Client-only settings (localStorage), hydration for appearance & workflows.
 */

import {
    applyAccentPresetToDocument,
    isAccentIdString,
    mirrorAccentToLegacyStorage,
    normalizeAccentId,
    readLegacyAccentFromStorage,
    type AccentId,
} from "./accent-preset";
import { normalizeFontStack, type FontStackId } from "./font-stack-preset";

export type { FontStackId } from "./font-stack-preset";
export { normalizeFontStack } from "./font-stack-preset";

export type DensityId = "compact" | "cozy" | "spacious";

/** Default Appointment overview view (`/appointments`). */
export type AppointmentCalendarView = "day" | "week" | "month";

/** Appearance: light / dark / system (system follows `prefers-color-scheme`). */
export type ColorSchemeId = "light" | "dark" | "system";

export type ClientSettingsV1 = {
    version: 1;
    appearance?: {
        /** Light · Dark · System — controls `html[data-theme]` (resolved incl. system). */
        colorScheme?: ColorSchemeId;
        /** In light appearance: sidebar dark only. */
        darkSidebar: boolean;
        density: DensityId;
        /** Font stack — controls `html[data-font-stack]`. */
        fontStack?: FontStackId;
        /** Brand accent (CSS --accent / --accent-soft / --accent-ink). */
        accentPreset?: AccentId;
        /** Topbar user avatar (circles with initials). */
        showHeaderAvatar?: boolean;
        /** Visible keyboard hints (e.g. ⌘K in rail). */
        showKeyboardHints?: boolean;
    };
    /** Calendar, appointments, day-end closing */
    workflows?: {
        /** Open `/appointments` with this view */
        appointmentsDefaultView?: AppointmentCalendarView;
        /** Preset duration in "New appointment" (minutes). */
        defaultAppointmentDurationMin?: number;
        /** Local time for one-time daily reminder (HH:mm, e.g. 18:00). */
        dayCloseReminderTime?: string;
        /** CAL2: pause/emergency toolbar in calendar (experimental). */
        calendarEmergencyToolbarEnabled?: boolean;
    };
    /** Search */
    search?: {
        /** When false: patient name only (backend); when true: name or insurance number. */
        patientIncludeInsuranceNumber?: boolean;
        /** NFA-USE-10: Levenshtein "did you mean" hints (patient list, quick access). Off when false. */
        autocompleteSuggestionsEnabled?: boolean;
    };
    /** Client-side session */
    security?: {
        /** Minutes without input until logout. 0 = off. */
        idleLogoutMinutes?: number;
        /** UI: two-factor — real wiring separate; preference stored locally. */
        twoFactorEnabled?: boolean;
    };
    /** Push/email — delivery may be wired later; toggles act as preference. */
    notifications?: {
        push?: boolean;
        emailSummary?: boolean;
        criticalWarnings?: boolean;
        patientSms?: boolean;
    };
    /** Integration flags (some connectors are placeholders). */
    integrations?: {
        datev?: boolean;
    };
    /** Patient record → open attachments externally: empty = recommended first app; "__SYSTEM__" = OS default only. */
    chart?: {
        openImagesWithApp?: string;
    };
};

const KEY = "medoc-client-settings-v1";

export const DEFAULT_CLIENT_SETTINGS: ClientSettingsV1 = {
    version: 1,
    appearance: {
        colorScheme: "light",
        darkSidebar: false,
        density: "cozy",
        fontStack: "inter",
        accentPreset: "mint",
        showHeaderAvatar: true,
        showKeyboardHints: true,
    },
    workflows: {
        appointmentsDefaultView: "month",
        defaultAppointmentDurationMin: 30,
        dayCloseReminderTime: "18:00",
        calendarEmergencyToolbarEnabled: false,
    },
    search: {
        patientIncludeInsuranceNumber: true,
        autocompleteSuggestionsEnabled: true,
    },
    security: {
        idleLogoutMinutes: 0,
        twoFactorEnabled: true,
    },
    notifications: {
        push: true,
        emailSummary: true,
        criticalWarnings: true,
        patientSms: false,
    },
    integrations: {
        datev: true,
    },
    chart: {
        openImagesWithApp: "",
    },
};

function mergeClient(a: ClientSettingsV1, b: Partial<ClientSettingsV1>): ClientSettingsV1 {
    return {
        version: 1,
        appearance: { ...a.appearance!, ...b.appearance },
        workflows: { ...a.workflows!, ...b.workflows },
        search: { ...a.search!, ...b.search },
        security: { ...a.security!, ...b.security },
        chart: { ...a.chart!, ...b.chart },
        notifications: { ...a.notifications!, ...b.notifications },
        integrations: { ...a.integrations!, ...b.integrations },
    };
}

/** Teil-Update relativ to einem geladenen Stand (z. B. React state). */
export function mergeClientSettingsPatch(base: ClientSettingsV1, patch: Partial<ClientSettingsV1>): ClientSettingsV1 {
    return mergeClient(base, patch);
}

/** Migrates old storage (notifications, integrations, …) away — known keys only. */
export function normalizeColorScheme(raw: unknown): ColorSchemeId {
    return raw === "dark" || raw === "system" || raw === "light" ? raw : "light";
}

export function normalizeAppointmentCalendarView(raw: unknown): AppointmentCalendarView {
    if (raw === "day" || raw === "tag") return "day";
    if (raw === "week" || raw === "woche") return "week";
    if (raw === "month" || raw === "monat") return "month";
    return "month";
}

function normalizeFromStorage(j: Partial<ClientSettingsV1>): ClientSettingsV1 {
    const base = mergeClient(DEFAULT_CLIENT_SETTINGS, j);
    const cs = base.appearance?.colorScheme;
    let out = base;
    if (cs != null && cs !== "light" && cs !== "dark" && cs !== "system") {
        out = mergeClient(out, { appearance: { ...out.appearance!, colorScheme: "light" } });
    }
    const view = normalizeAppointmentCalendarView(j.workflows?.appointmentsDefaultView);
    if (out.workflows?.appointmentsDefaultView !== view) {
        out = mergeClient(out, { workflows: { ...out.workflows!, appointmentsDefaultView: view } });
    }
    return out;
}

/** Resolved theme for UI incl. system preference. */
export function resolveAppearanceTheme(s: ClientSettingsV1): "light" | "dark" {
    const pref = normalizeColorScheme(s.appearance?.colorScheme);
    if (pref === "dark") return "dark";
    if (pref === "light") return "light";
    if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    return "light";
}

export function loadClientSettings(): ClientSettingsV1 {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return mergeClient(DEFAULT_CLIENT_SETTINGS, {});
        const j = JSON.parse(raw) as Partial<ClientSettingsV1>;
        if (j.version !== 1) return mergeClient(DEFAULT_CLIENT_SETTINGS, {});
        let out = normalizeFromStorage(j);
        const rawAp = j.appearance?.accentPreset;
        const hasStoredPreset = isAccentIdString(rawAp);
        if (!hasStoredPreset) {
            const leg = readLegacyAccentFromStorage();
            if (leg != null) {
                out = mergeClient(out, { appearance: { ...out.appearance!, accentPreset: leg } });
                try {
                    localStorage.setItem(KEY, JSON.stringify(out));
                } catch {
                    /* ignore */
                }
            }
        }
        return out;
    } catch {
        return mergeClient(DEFAULT_CLIENT_SETTINGS, {});
    }
}

export function saveClientSettings(next: ClientSettingsV1): void {
    localStorage.setItem(KEY, JSON.stringify(next));
}

/** Applies appearance, sidebar tone, density, accent, avatar & keyboard hints to `<html>`. */
export function applyAppearanceFromSettings(s: ClientSettingsV1): void {
    const pref = normalizeColorScheme(s.appearance?.colorScheme);
    document.documentElement.dataset.colorScheme = pref;
    const resolved = resolveAppearanceTheme(s);
    document.documentElement.dataset.theme = resolved;

    const sidebarDark = resolved === "dark" || (s.appearance?.darkSidebar ?? false);
    document.documentElement.dataset.sidebarTone = sidebarDark ? "dark" : "light";
    let density = s.appearance?.density ?? "cozy";
    if (density !== "compact" && density !== "cozy" && density !== "spacious") density = "cozy";
    document.documentElement.dataset.density = density;
    const av = s.appearance?.showHeaderAvatar !== false;
    document.documentElement.dataset.headerAvatar = av ? "true" : "false";
    const kbd = s.appearance?.showKeyboardHints !== false;
    document.documentElement.dataset.kbdHints = kbd ? "true" : "false";
    const accent = normalizeAccentId(s.appearance?.accentPreset);
    applyAccentPresetToDocument(accent, resolved);
    mirrorAccentToLegacyStorage(accent);
    const fs = normalizeFontStack(s.appearance?.fontStack);
    document.documentElement.dataset.fontStack = fs;
}

export function hydrateAppearanceFromStorage(): void {
    applyAppearanceFromSettings(loadClientSettings());
}

let appearanceMediaListenerInstalled = false;

/** When `colorScheme: system` reapply theme when OS preference changes. */
export function initAppearanceMediaListener(): void {
    if (typeof window === "undefined" || appearanceMediaListenerInstalled) return;
    appearanceMediaListenerInstalled = true;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
        try {
            const s = loadClientSettings();
            if (normalizeColorScheme(s.appearance?.colorScheme) === "system") {
                applyAppearanceFromSettings(s);
            }
        } catch {
            /* ignore */
        }
    };
    mq.addEventListener("change", onChange);
}
