/**
 * Device-local Appearance + locale prefs (`{app_data_dir}/config/ui-prefs.json`).
 *
 * **Source of truth on desktop:** the JSON file (per HOME / instance).
 * `localStorage` is only a webview cache and is shared across same-origin Vite
 * instances in multi-instance dev — it must never win over the file on boot.
 */
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import {
    applyAppearanceFromSettings,
    loadClientSettings,
    type ClientSettingsV1,
} from "@/lib/client-settings";
import type { Locale } from "@/lib/i18n";
import { useAuthStore } from "@/models/store/auth-store";

export type UiPrefsDto = {
    locale: string | null;
    settingsJson: string | null;
    path: string;
};

export const UI_PREFS_CLIENT_SETTINGS_KEY = "medoc-client-settings-v1";
export const UI_PREFS_LOCALE_STORE_KEY = "medoc-locale";

/** Skip writing the config file while applying a disk hydrate. */
let uiPrefsHydrating = false;

/** Coalesce overlapping persists (rapid Appearance clicks / locale toggles). */
let persistChain: Promise<void> = Promise.resolve();

function asLocale(v: string | null | undefined): Locale | null {
    if (v === "de" || v === "en" || v === "fr" || v === "ar") return v;
    return null;
}

function currentUserId(): string | null {
    try {
        return useAuthStore.getState().session?.user_id?.trim() || null;
    } catch {
        return null;
    }
}

export async function getUiPrefs(userId?: string | null): Promise<UiPrefsDto> {
    return practiceSystem.invoke<UiPrefsDto>("get_ui_prefs", {
        userId: userId?.trim() || null,
    });
}

export async function setUiPrefs(args: {
    userId?: string | null;
    locale?: Locale | null;
    settings?: ClientSettingsV1 | null;
}): Promise<UiPrefsDto> {
    return practiceSystem.invoke<UiPrefsDto>("set_ui_prefs", {
        args: {
            userId: args.userId?.trim() || null,
            locale: args.locale ?? null,
            settingsJson: args.settings != null ? JSON.stringify(args.settings) : null,
        },
    });
}

/** Parse settings blob from the desktop config file. */
export function parseUiPrefsSettings(raw: string | null | undefined): ClientSettingsV1 | null {
    if (!raw?.trim()) return null;
    try {
        const j = JSON.parse(raw) as Partial<ClientSettingsV1>;
        if (j.version !== 1) return null;
        return j as ClientSettingsV1;
    } catch {
        return null;
    }
}

export function localeFromUiPrefs(dto: UiPrefsDto): Locale | null {
    return asLocale(dto.locale);
}

export function writeLocaleStoreCache(locale: Locale): void {
    try {
        globalThis.localStorage?.setItem(
            UI_PREFS_LOCALE_STORE_KEY,
            JSON.stringify({ state: { locale }, version: 0 }),
        );
    } catch {
        /* ignore */
    }
}

export function writeClientSettingsCache(settings: ClientSettingsV1): void {
    try {
        globalThis.localStorage?.setItem(UI_PREFS_CLIENT_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        /* ignore */
    }
}

/**
 * Awaitable write into the instance config file.
 * Queued so concurrent Appearance/locale saves do not lose the last write.
 */
export function persistUiPrefs(patch: {
    locale?: Locale | null;
    settings?: ClientSettingsV1 | null;
    userId?: string | null;
}): Promise<void> {
    if (uiPrefsHydrating) return Promise.resolve();
    if (patch.locale == null && patch.settings == null) return Promise.resolve();
    const userId = patch.userId !== undefined ? patch.userId : currentUserId();
    const run = async () => {
        try {
            await setUiPrefs({
                userId,
                locale: patch.locale,
                settings: patch.settings,
            });
        } catch {
            /* browser / LAN client / tests — localStorage remains cache only */
        }
    };
    persistChain = persistChain.then(run, run);
    return persistChain;
}

/** Fire-and-forget wrapper (Appearance rapid toggles). */
export function schedulePersistUiPrefs(patch: {
    locale?: Locale | null;
    settings?: ClientSettingsV1 | null;
    userId?: string | null;
}): void {
    void persistUiPrefs(patch);
}

async function adoptLocale(locale: Locale): Promise<void> {
    // Cache first so zustand `persist` rehydrate (on i18n import) sees the file locale.
    writeLocaleStoreCache(locale);
    const { adoptLocaleFromDisk } = await import("@/lib/i18n");
    adoptLocaleFromDisk(locale);
    writeLocaleStoreCache(locale);
}

function readLocaleFromCache(): Locale | null {
    try {
        const raw = globalThis.localStorage?.getItem(UI_PREFS_LOCALE_STORE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { state?: { locale?: string } };
        return asLocale(parsed.state?.locale);
    } catch {
        return null;
    }
}

/**
 * Load `{app_data_dir}/config/ui-prefs.json` into localStorage + live UI.
 *
 * Rules:
 * - File settings/locale always overwrite the shared-origin cache.
 * - Empty file → one-shot migrate from cache into the file.
 * - File has settings but no locale → pin the post-hydrate locale into the file
 *   so the next refresh cannot fall back to another instance's shared LS language.
 */
export async function hydrateUiPrefsFromDisk(userId?: string | null): Promise<UiPrefsDto | null> {
    uiPrefsHydrating = true;
    try {
        let dto: UiPrefsDto;
        try {
            dto = await getUiPrefs(userId ?? currentUserId());
        } catch {
            return null;
        }

        const fromFileSettings = parseUiPrefsSettings(dto.settingsJson);
        const fromFileLocale = localeFromUiPrefs(dto);

        if (fromFileSettings) {
            writeClientSettingsCache(fromFileSettings);
            applyAppearanceFromSettings(fromFileSettings);
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("medoc-client-settings"));
            }
        }

        if (fromFileLocale) {
            await adoptLocale(fromFileLocale);
        }

        const resolvedUserId = userId ?? currentUserId();

        // First-run migration: nothing on disk yet → copy cache into the instance file once.
        if (!fromFileSettings && !fromFileLocale) {
            const localSettings = loadClientSettings();
            const localLocale = readLocaleFromCache();
            uiPrefsHydrating = false;
            await persistUiPrefs({
                userId: resolvedUserId,
                locale: localLocale,
                settings: localSettings,
            });
            return dto;
        }

        // Do NOT invent a locale from shared-origin localStorage when the file has
        // settings but no locale — that cache is polluted across instances.
        // The next setLocale / Appearance save pins locale into the file.

        return dto;
    } finally {
        uiPrefsHydrating = false;
    }
}
