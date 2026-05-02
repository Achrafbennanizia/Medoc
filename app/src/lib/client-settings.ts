/**
 * Client-only Einstellungen (localStorage), hydration für Darstellung & Arbeitsabläufe.
 */

export type DensityId = "compact" | "cozy" | "spacious";

/** Standard-Ansicht Terminübersicht (`/termine`). */
export type TermineKalenderAnsicht = "tag" | "woche" | "monat";

export type ClientSettingsV1 = {
    version: 1;
    appearance?: {
        darkSidebar: boolean;
        density: DensityId;
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
    };
    /** Suche */
    search?: {
        /** Bei false: nur Patientenname (Backend); bei true: Name oder Versicherungsnummer. */
        patientIncludeVersicherungsnummer?: boolean;
    };
    /** Clientseitige Sitzung */
    security?: {
        /** Minuten ohne Eingabe bis Abmeldung. 0 = aus. */
        idleLogoutMinutes?: number;
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
        darkSidebar: false,
        density: "cozy",
        showHeaderAvatar: true,
        showKeyboardHints: true,
    },
    workflows: {
        termineDefaultView: "monat",
        defaultTerminDauerMin: 30,
        tagesabschlussReminderTime: "18:00",
    },
    search: {
        patientIncludeVersicherungsnummer: true,
    },
    security: {
        idleLogoutMinutes: 0,
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
    };
}

/** Teil-Update relativ zu einem geladenen Stand (z. B. React state). */
export function mergeClientSettingsPatch(base: ClientSettingsV1, patch: Partial<ClientSettingsV1>): ClientSettingsV1 {
    return mergeClient(base, patch);
}

/** Migriert alte Speicherstände (notifications, integrations, …) weg — nur noch bekannte Keys. */
function normalizeFromStorage(j: Partial<ClientSettingsV1>): ClientSettingsV1 {
    return mergeClient(DEFAULT_CLIENT_SETTINGS, j);
}

export function loadClientSettings(): ClientSettingsV1 {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return mergeClient(DEFAULT_CLIENT_SETTINGS, {});
        const j = JSON.parse(raw) as Partial<ClientSettingsV1>;
        if (j.version !== 1) return mergeClient(DEFAULT_CLIENT_SETTINGS, {});
        return normalizeFromStorage(j);
    } catch {
        return mergeClient(DEFAULT_CLIENT_SETTINGS, {});
    }
}

export function saveClientSettings(next: ClientSettingsV1): void {
    localStorage.setItem(KEY, JSON.stringify(next));
}

/** Wendet Sidebar-Ton, Dichte, Avatar- & Kbd-Hinweise auf `<html>` an (vor Render der Shell konsistent). */
export function applyAppearanceFromSettings(s: ClientSettingsV1): void {
    const dark = s.appearance?.darkSidebar ?? false;
    let density = s.appearance?.density ?? "cozy";
    if (density !== "compact" && density !== "cozy" && density !== "spacious") density = "cozy";
    document.documentElement.dataset.sidebarTone = dark ? "dark" : "light";
    document.documentElement.dataset.density = density;
    const av = s.appearance?.showHeaderAvatar !== false;
    document.documentElement.dataset.headerAvatar = av ? "true" : "false";
    const kbd = s.appearance?.showKeyboardHints !== false;
    document.documentElement.dataset.kbdHints = kbd ? "true" : "false";
}

export function hydrateAppearanceFromStorage(): void {
    applyAppearanceFromSettings(loadClientSettings());
}
