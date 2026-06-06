/**
 * Client-only Einstellungen (localStorage), hydration für Darstellung & Arbeitsabläufe.
 */

import {
    applyAccentPresetToDocument,
    isAccentIdString,
    mirrorAccentToLegacyStorage,
    normalizeAccentId,
    readLegacyAccentFromStorage,
    type AccentId,
} from "./accent-preset";

export type DensityId = "compact" | "cozy" | "spacious";

/** Standard-Ansicht Terminübersicht (`/termine`). */
export type TermineKalenderAnsicht = "tag" | "woche" | "monat";

export type FontStackId = "inter" | "system";

/** Erscheinungsbild: Hell / Dunkel / System (letzteres folgt `prefers-color-scheme`). */
export type ColorSchemeId = "light" | "dark" | "system";

export type ClientSettingsV1 = {
    version: 1;
    appearance?: {
        /** Hell · Dunkel · System — steuert `html[data-theme]` (aufgelöst inkl. System). */
        colorScheme?: ColorSchemeId;
        /** Bei hellem Erscheinungsbild: nur Seitenleiste dunkel. */
        darkSidebar: boolean;
        density: DensityId;
        /** «Systemschrift» vs Inter — steuert `html[data-font-stack]`. */
        fontStack?: FontStackId;
        /** Marken-Akzent (CSS --accent / --accent-soft / --accent-ink). */
        accentPreset?: AccentId;
        /** Topbar-Benutzer-Avatar (Kreise mit Initialen). */
        showHeaderAvatar?: boolean;
        /** Sichtbare Kbd-Hinweise (z. B. ⌘K in der Leiste). */
        showKeyboardHints?: boolean;
    };
    /** Kalender, Termine, Tagesabschluss */
    workflows?: {
        /** Öffnen von `/termine` mit dieser Ansicht */
        termineDefaultView?: TermineKalenderAnsicht;
        /** Vorauswahl Dauer in „Neuer Termin“ (Minuten). */
        defaultTerminDauerMin?: number;
        /** Lokale Uhrzeit für einmalige Tages-Erinnerung (HH:mm, z. B. 18:00). */
        tagesabschlussReminderTime?: string;
        /** CAL2: Pause/Notfall-Toolbar im Kalender (experimentell). */
        calendarEmergencyToolbarEnabled?: boolean;
    };
    /** Suche */
    search?: {
        /** Bei false: nur Patientenname (Backend); bei true: Name oder Versicherungsnummer. */
        patientIncludeVersicherungsnummer?: boolean;
        /** NFA-USE-10: Levenshtein-„Meinten Sie …“-Hinweise (Patientenliste, Schnellzugriff). Bei false aus. */
        autocompleteSuggestionsEnabled?: boolean;
    };
    /** Clientseitige Sitzung */
    security?: {
        /** Minuten ohne Eingabe bis Abmeldung. 0 = aus. */
        idleLogoutMinutes?: number;
        /** UI: Zwei-Faktor — echte Anbindung separat; Vorgabe lokal gespeichert. */
        twoFactorEnabled?: boolean;
    };
    /** Push/E-Mail — Auslieferung ggf. später angebunden; Schalter wirken als Präferenz. */
    notifications?: {
        push?: boolean;
        emailSummary?: boolean;
        criticalWarnings?: boolean;
        patientSms?: boolean;
    };
    /** Integrations-Flags (Anbindungen teils Platzhalter). */
    integrations?: {
        datev?: boolean;
    };
    /** Akte → Anlagen extern öffnen: leer = empfohlene erste App; "__SYSTEM__" = nur Betriebssystem-Standard. */
    akte?: {
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
        termineDefaultView: "monat",
        defaultTerminDauerMin: 30,
        tagesabschlussReminderTime: "18:00",
        calendarEmergencyToolbarEnabled: false,
    },
    search: {
        patientIncludeVersicherungsnummer: true,
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
    akte: {
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
        akte: { ...a.akte!, ...b.akte },
        notifications: { ...a.notifications!, ...b.notifications },
        integrations: { ...a.integrations!, ...b.integrations },
    };
}

/** Teil-Update relativ zu einem geladenen Stand (z. B. React state). */
export function mergeClientSettingsPatch(base: ClientSettingsV1, patch: Partial<ClientSettingsV1>): ClientSettingsV1 {
    return mergeClient(base, patch);
}

/** Migriert alte Speicherstände (notifications, integrations, …) weg — nur noch bekannte Keys. */
export function normalizeColorScheme(raw: unknown): ColorSchemeId {
    return raw === "dark" || raw === "system" || raw === "light" ? raw : "light";
}

function normalizeFromStorage(j: Partial<ClientSettingsV1>): ClientSettingsV1 {
    const base = mergeClient(DEFAULT_CLIENT_SETTINGS, j);
    const cs = base.appearance?.colorScheme;
    if (cs != null && cs !== "light" && cs !== "dark" && cs !== "system") {
        return mergeClient(base, { appearance: { ...base.appearance!, colorScheme: "light" } });
    }
    return base;
}

/** Aufgelöstes Theme für Oberfläche inkl. System-Präferenz. */
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

/** Wendet Erscheinungsbild, Sidebar-Ton, Dichte, Akzent, Avatar- & Kbd-Hinweise auf `<html>` an. */
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
    const fs = s.appearance?.fontStack === "system" ? "system" : "inter";
    document.documentElement.dataset.fontStack = fs;
}

export function hydrateAppearanceFromStorage(): void {
    applyAppearanceFromSettings(loadClientSettings());
}

let appearanceMediaListenerInstalled = false;

/** Bei `colorScheme: system` Theme neu anwenden, wenn die OS-Präferenz wechselt. */
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
