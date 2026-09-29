import { describe, expect, it } from "vitest";
import {
    localeCatalogKeys,
    translateLocale,
    translateLocaleParams,
    isRtlLocale,
    bcp47ForLocale,
    type Locale,
} from "./i18n";
import deCatalog from "../../locales/de.json";
import enCatalog from "../../locales/en.json";
import frCatalog from "../../locales/fr.json";
import arCatalog from "../../locales/ar.json";

const LOCALES: Locale[] = ["de", "en", "fr", "ar"];
const CATALOGS = { de: deCatalog, en: enCatalog, fr: frCatalog, ar: arCatalog };

describe("i18n locale parity", () => {
    it("JSON catalogs have identical key sets", () => {
        const deKeys = Object.keys(deCatalog).sort();
        for (const loc of LOCALES) {
            expect(Object.keys(CATALOGS[loc]).sort()).toEqual(deKeys);
            expect(localeCatalogKeys(loc).sort()).toEqual(deKeys);
        }
    });

    it("fr and ar expose every de key with non-key values", () => {
        // ~4.5k keys: avoid per-key expect()/Array.includes (O(n²) → Windows CI timeout).
        const deKeys = localeCatalogKeys("de");
        for (const loc of ["fr", "ar"] as const) {
            const keySet = new Set(localeCatalogKeys(loc));
            const missing = deKeys.filter((key) => !keySet.has(key));
            const untranslated = deKeys.filter((key) => translateLocale(loc, key) === key);
            expect(missing, `${loc} missing keys`).toEqual([]);
            expect(untranslated, `${loc} value===key`).toEqual([]);
        }
    });

    it("all locales resolve core nav keys", () => {
        const keys = ["nav.settings", "nav.prescriptions", "common.loading"];
        for (const loc of LOCALES) {
            for (const key of keys) {
                expect(translateLocale(loc, key)).not.toBe(key);
            }
        }
    });

    it("all locales keep English interpolation names and no placeholder artifacts", () => {
        const ph = /\{[^{}]+\}/g;
        const mismatches: string[] = [];
        for (const loc of ["de", "fr", "ar"] as const) {
            const catalog = CATALOGS[loc] as Record<string, string>;
            for (const key of Object.keys(enCatalog) as string[]) {
                const val = String(catalog[key] ?? "");
                const enVal = String((enCatalog as Record<string, string>)[key] ?? "");
                const got = new Set(val.match(ph) ?? []);
                const want = new Set(enVal.match(ph) ?? []);
                if (got.size !== want.size || [...want].some((p) => !got.has(p))) {
                    mismatches.push(`${loc}:${key}`);
                }
                if (/^Ph0$/i.test(val.trim()) || /__\s*PH\d/i.test(val) || /&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/.test(val)) {
                    mismatches.push(`${loc}:${key}`);
                }
            }
        }
        expect(mismatches).toEqual([]);
    });

    it("Arabic critical keys use Arabic script", () => {
        const arabicRe = /[\u0600-\u06FF]/;
        for (const key of ["auth.login", "auth.logout", "common.save", "nav.patients"]) {
            expect(arabicRe.test(translateLocale("ar", key))).toBe(true);
        }
    });

    it("Arabic duration uses hour and minute words", () => {
        const text = translateLocaleParams("ar", "common.duration.hours_minutes", { h: 1, m: 0 });
        expect(text).toContain("ساعة");
        expect(text).toContain("دقيقة");
        expect(text).not.toMatch(/\bh\b/);
        expect(text).not.toMatch(/\bm\b/);
        expect(translateLocaleParams("ar", "common.duration.hours_minutes_short", { h: 1, m: 30 })).toBe("1 س · 30 د");
        expect(translateLocaleParams("ar", "appointment.drawer.duration_min", { min: 45 })).toBe("45 د.");
    });

    it("RTL locale helper marks Arabic", () => {
        expect(isRtlLocale("ar")).toBe(true);
        expect(isRtlLocale("de")).toBe(false);
    });

    it("bcp47ForLocale maps UI locales to Intl tags", () => {
        expect(bcp47ForLocale("de")).toBe("de-DE-u-ca-gregory");
        expect(bcp47ForLocale("en")).toBe("en-US-u-ca-gregory");
        expect(bcp47ForLocale("fr")).toBe("fr-FR-u-ca-gregory");
        expect(bcp47ForLocale("ar")).toBe("ar-EG-u-ca-gregory-nu-latn");
    });
});
