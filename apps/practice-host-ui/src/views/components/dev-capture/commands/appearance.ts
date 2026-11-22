/** Language, theme and Appearance settings, with a probe of what each option changes. */
import { applyAppearanceFromSettings, DEFAULT_CLIENT_SETTINGS, loadClientSettings, mergeClientSettingsPatch, saveClientSettings, type ClientSettingsV1 } from "@/lib/client-settings";
import { useLocale } from "@/lib/i18n";
import { delay } from "../dom";
import { appearanceSignature } from "../probes";
import { missing, type CaptureCommandGroup } from "../types";

type Appearance = NonNullable<ClientSettingsV1["appearance"]>;

function saveAppearance(change: (a: Appearance) => Appearance): void {
    const cur = loadClientSettings();
    const next = mergeClientSettingsPatch(cur, { appearance: change(cur.appearance ?? DEFAULT_CLIENT_SETTINGS.appearance!) });
    saveClientSettings(next);
    applyAppearanceFromSettings(next);
}

export const appearanceCommands: CaptureCommandGroup = {
    setLocale: (cmd) => {
        if (!cmd.locale) return missing("locale");
        useLocale.getState().setLocale(cmd.locale);
        return {};
    },
    setTheme: (cmd) => {
        if (!cmd.theme) return missing("theme");
        saveAppearance((a) => ({ ...a, colorScheme: cmd.theme }));
        return {};
    },
    /** `value` = JSON patch for `appearance` (display prefs under `display`); "{}" = measure only. */
    appearanceProbe: async (cmd) => {
        const patch = JSON.parse(cmd.value || "{}") as Record<string, unknown>;
        if (Object.keys(patch).length) {
            saveAppearance((a) => ({ ...a, ...patch, display: patch.display ? { ...(a.display ?? {}), ...(patch.display as object) } : a.display }));
            await delay(700);
        }
        return appearanceSignature();
    },
};
