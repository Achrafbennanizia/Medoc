/**
 * Client-only Einstellungen (localStorage), hydration für Darstellung & Benachrichtigungs-Flags.
 * Server-Stammdaten bleiben über Tauri/KV wo vorhanden.
 */

export type DensityId = "compact" | "cozy" | "spacious";

/** Standard-Ansicht Terminübersicht (`/termine`). */
export type TermineKalenderAnsicht = "tag" | "woche" | "monat";

export type ClientSettingsV1 = {
    version: 1;
    notifications?: {
        push: boolean;
        mailDigest: boolean;
        criticalAlerts: boolean;
        smsReminders: boolean;
    };
    security?: {
        remindTwoFactor: boolean;
        remindAutoLock: boolean;
    };
    integrations?: {
        datevMonthlyExport: boolean;
        doccheckSso: boolean;
        tkKim: boolean;
        laborDentalUnion: boolean;
    };
    appearance?: {
        darkSidebar: boolean;
        density: DensityId;
    };
    /** Kalender & Termin-Workflow */
    workflows?: {
        /** Öffnen von `/termine` mit dieser Ansicht */
        termineDefaultView?: TermineKalenderAnsicht;
    };
    /** Akte → Anlagen extern öffnen: leer = empfohlene erste App; "__SYSTEM__" = nur Betriebssystem-Standard. */
    akte?: {
        /** Pfad zur .app / .exe oder "__SYSTEM__" */
        openImagesWithApp?: string;
    };
};

const KEY = "medoc-client-settings-v1";

export const DEFAULT_CLIENT_SETTINGS: ClientSettingsV1 = {
    version: 1,
    notifications: {
        push: true,
        mailDigest: true,
        criticalAlerts: true,
        smsReminders: false,
    },
    security: {
        remindTwoFactor: false,
        remindAutoLock: true,
    },
    integrations: {
        datevMonthlyExport: false,
        doccheckSso: false,
        tkKim: true,
        laborDentalUnion: false,
    },
    appearance: {
        darkSidebar: false,
        density: "cozy",
    },
    workflows: {
        termineDefaultView: "monat",
    },
    akte: {
        openImagesWithApp: "",
    },
};

function mergeClient(a: ClientSettingsV1, b: Partial<ClientSettingsV1>): ClientSettingsV1 {
    return {
        version: 1,
        notifications: { ...a.notifications!, ...b.notifications },
        security: { ...a.security!, ...b.security },
        integrations: { ...a.integrations!, ...b.integrations },
        appearance: { ...a.appearance!, ...b.appearance },
        workflows: { ...a.workflows!, ...b.workflows },
        akte: { ...a.akte!, ...b.akte },
    };
}

/** Teil-Update relativ zu einem geladenen Stand (z. B. React state). */
export function mergeClientSettingsPatch(base: ClientSettingsV1, patch: Partial<ClientSettingsV1>): ClientSettingsV1 {
    return mergeClient(base, patch);
}

export function loadClientSettings(): ClientSettingsV1 {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return mergeClient(DEFAULT_CLIENT_SETTINGS, {});
        const j = JSON.parse(raw) as Partial<ClientSettingsV1>;
        if (j.version !== 1) return mergeClient(DEFAULT_CLIENT_SETTINGS, {});
        return mergeClient(DEFAULT_CLIENT_SETTINGS, j);
    } catch {
        return mergeClient(DEFAULT_CLIENT_SETTINGS, {});
    }
}

export function saveClientSettings(next: ClientSettingsV1): void {
    localStorage.setItem(KEY, JSON.stringify(next));
}

/** Wendet Sidebar-Ton & globale Schrift-/Dichte-Stufe auf `<html>` an (vor Render der Shell konsistent). */
export function applyAppearanceFromSettings(s: ClientSettingsV1): void {
    const dark = s.appearance?.darkSidebar ?? false;
    let density = s.appearance?.density ?? "cozy";
    if (density !== "compact" && density !== "cozy" && density !== "spacious") density = "cozy";
    document.documentElement.dataset.sidebarTone = dark ? "dark" : "light";
    document.documentElement.dataset.density = density;
}

export function hydrateAppearanceFromStorage(): void {
    applyAppearanceFromSettings(loadClientSettings());
}
