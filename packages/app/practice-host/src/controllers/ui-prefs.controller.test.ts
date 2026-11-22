import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@/systems/practice-host/adapters/practice-transport", () => ({
    practiceSystem: {
        invoke: (...args: unknown[]) => invoke(...args),
    },
}));

vi.mock("@/models/store/auth-store", () => ({
    useAuthStore: {
        getState: () => ({ session: null }),
    },
}));

vi.mock("@/lib/client-settings", async () => {
    const actual = await vi.importActual<typeof import("@/lib/client-settings")>("@/lib/client-settings");
    return {
        ...actual,
        applyAppearanceFromSettings: vi.fn(),
    };
});

vi.mock("@/lib/i18n", () => {
    let locale: "de" | "en" | "fr" | "ar" = "en";
    const adoptLocaleFromDisk = vi.fn((l: "de" | "en" | "fr" | "ar") => {
        locale = l;
    });
    return {
        adoptLocaleFromDisk,
        useLocale: {
            getState: () => ({ locale }),
        },
    };
});

import { applyAppearanceFromSettings } from "@/lib/client-settings";
import { adoptLocaleFromDisk } from "@/lib/i18n";
import {
    hydrateUiPrefsFromDisk,
    UI_PREFS_CLIENT_SETTINGS_KEY,
    UI_PREFS_LOCALE_STORE_KEY,
} from "./ui-prefs.controller";

describe("hydrateUiPrefsFromDisk", () => {
    const ls = new Map<string, string>();

    beforeEach(() => {
        invoke.mockReset();
        vi.mocked(applyAppearanceFromSettings).mockReset();
        vi.mocked(adoptLocaleFromDisk).mockClear();
        ls.clear();
        const storage = {
            getItem: (k: string) => ls.get(k) ?? null,
            setItem: (k: string, v: string) => {
                ls.set(k, v);
            },
            removeItem: (k: string) => {
                ls.delete(k);
            },
            clear: () => ls.clear(),
        };
        vi.stubGlobal("localStorage", storage);
        vi.stubGlobal("window", {
            localStorage: storage,
            dispatchEvent: vi.fn(),
        });
        // Polluted shared-origin cache (other instance wrote English / defaults).
        ls.set(
            UI_PREFS_LOCALE_STORE_KEY,
            JSON.stringify({ state: { locale: "en" }, version: 0 }),
        );
        ls.set(
            UI_PREFS_CLIENT_SETTINGS_KEY,
            JSON.stringify({
                version: 1,
                appearance: { density: "spacious", darkSidebar: false },
            }),
        );
    });

    it("lets the instance file win over shared-origin localStorage (regression: refresh→EN)", async () => {
        const fileSettings = {
            version: 1 as const,
            appearance: {
                density: "compact" as const,
                darkSidebar: true,
                colorScheme: "dark" as const,
            },
        };
        invoke.mockImplementation(async (cmd: string) => {
            if (cmd === "get_ui_prefs") {
                return {
                    locale: "de",
                    settingsJson: JSON.stringify(fileSettings),
                    path: "/tmp/ui-prefs.json",
                };
            }
            throw new Error(`unexpected ${cmd}`);
        });

        await hydrateUiPrefsFromDisk();

        const localeCache = JSON.parse(ls.get(UI_PREFS_LOCALE_STORE_KEY)!);
        expect(localeCache.state.locale).toBe("de");
        expect(adoptLocaleFromDisk).toHaveBeenCalledWith("de");

        const settingsCache = JSON.parse(ls.get(UI_PREFS_CLIENT_SETTINGS_KEY)!);
        expect(settingsCache.appearance.density).toBe("compact");
        expect(settingsCache.appearance.darkSidebar).toBe(true);
        expect(applyAppearanceFromSettings).toHaveBeenCalled();

        // Must not re-migrate shared LS back into the file when file already has prefs.
        expect(invoke.mock.calls.some((c) => c[0] === "set_ui_prefs")).toBe(false);
    });

    it("migrates empty file from cache once", async () => {
        invoke.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
            if (cmd === "get_ui_prefs") {
                return { locale: null, settingsJson: null, path: "/tmp/ui-prefs.json" };
            }
            if (cmd === "set_ui_prefs") {
                return {
                    locale: (args?.args as { locale?: string } | undefined)?.locale ?? null,
                    settingsJson: (args?.args as { settingsJson?: string } | undefined)?.settingsJson ?? null,
                    path: "/tmp/ui-prefs.json",
                };
            }
            throw new Error(`unexpected ${cmd}`);
        });

        await hydrateUiPrefsFromDisk();

        const setCall = invoke.mock.calls.find((c) => c[0] === "set_ui_prefs");
        expect(setCall).toBeTruthy();
        const payload = setCall![1] as { args: { locale: string; settingsJson: string } };
        expect(payload.args.locale).toBe("en");
        expect(payload.args.settingsJson).toContain("spacious");
    });
});
