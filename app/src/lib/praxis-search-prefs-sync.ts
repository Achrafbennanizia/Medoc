/**
 * NFA-USE-10 / A13 — Autocomplete-Schalter zusätzlich in SQLite `praxis.preferences.v1`
 * (praxisweit). Lokales `client-settings` bleibt Quelle für das UI; KV wird beim Login
 * gemerged und beim Umschalten in den Einstellungen geschrieben.
 */

import {
    PRAXIS_PREFERENCES_KV_KEY,
    parsePraxisPreferencesV1,
    type PraxisPreferencesV1,
} from "@/lib/confirmation-preferences";
import { getAppKv, setAppKv } from "@/controllers/app-kv.controller";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    mergeClientSettingsPatch,
    saveClientSettings,
} from "@/lib/client-settings";

export async function persistAutocompleteSuggestionsToPraxisKv(enabled: boolean): Promise<void> {
    const raw = await getAppKv(PRAXIS_PREFERENCES_KV_KEY);
    const base = parsePraxisPreferencesV1(raw);
    const merged: PraxisPreferencesV1 = {
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
    await setAppKv(PRAXIS_PREFERENCES_KV_KEY, JSON.stringify(merged));
}

/** Liest Praxis-KV und übernimmt `autocompleteSuggestionsEnabled`, falls gesetzt (KV hat Vorrang). */
export async function mergeAutocompleteFromPraxisKvIntoLocal(): Promise<void> {
    const raw = await getAppKv(PRAXIS_PREFERENCES_KV_KEY);
    const p = parsePraxisPreferencesV1(raw);
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
