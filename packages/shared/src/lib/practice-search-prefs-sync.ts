/**
 * NFA-USE-10 / A13 — autocomplete toggle also in SQLite `practice.preferences.v1`
 * (practice-wide). Local `client-settings` remains UI source; KV on login
 * merged and written to Settings when toggled.
 */

import {
    PRACTICE_PREFERENCES_KV_KEY,
    parsePracticePreferencesV1,
    type PracticePreferencesV1,
} from "@/lib/confirmation-preferences";
import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    mergeClientSettingsPatch,
    saveClientSettings,
} from "@/lib/client-settings";

export async function persistAutocompleteSuggestionsToPracticeKv(enabled: boolean): Promise<void> {
    const raw = await getAppKv(PRACTICE_PREFERENCES_KV_KEY);
    const base = parsePracticePreferencesV1(raw);
    const merged: PracticePreferencesV1 = {
        ...base,
        version: 1,
        ui: {
            ...base.ui,
            search: {
                ...base.ui?.search,
                autocompleteSuggestionsEnabled: enabled,
            },
        },
    };
    await setAppKv(PRACTICE_PREFERENCES_KV_KEY, JSON.stringify(merged));
}

/** Reads practice KV and adopts `autocompleteSuggestionsEnabled` if set (KV takes precedence). */
export async function mergeAutocompleteFromPracticeKvIntoLocal(): Promise<void> {
    const raw = await getAppKv(PRACTICE_PREFERENCES_KV_KEY);
    const p = parsePracticePreferencesV1(raw);
    const ac = p.ui?.search?.autocompleteSuggestionsEnabled;
    if (typeof ac !== "boolean") return;
    const cur = loadClientSettings();
    const s = cur.search ?? DEFAULT_CLIENT_SETTINGS.search!;
    const localEnabled = s.autocompleteSuggestionsEnabled !== false;
    if (localEnabled === ac) return;
    const next = mergeClientSettingsPatch(cur, {
        search: { ...s, autocompleteSuggestionsEnabled: ac },
    });
    saveClientSettings(next);
}
