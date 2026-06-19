import { describe, expect, it } from "vitest";
import { localeCatalogKeys, translateLocale, isRtlLocale, type Locale } from "./i18n";
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
        const deKeys = localeCatalogKeys("de");
        for (const loc of ["fr", "ar"] as const) {
            for (const key of deKeys) {
                expect(localeCatalogKeys(loc)).toContain(key);
                expect(translateLocale(loc, key)).not.toBe(key);
            }
        }
    });

    it("all locales resolve core nav keys", () => {
        const keys = ["nav.einstellungen", "nav.rezepte", "common.loading"];
        for (const loc of LOCALES) {
            for (const key of keys) {
                expect(translateLocale(loc, key)).not.toBe(key);
            }
        }
    });

    it("Arabic critical keys use Arabic script", () => {
        const arabicRe = /[\u0600-\u06FF]/;
        for (const key of ["auth.login", "auth.logout", "common.save", "nav.patienten"]) {
            expect(arabicRe.test(translateLocale("ar", key))).toBe(true);
        }
    });

    it("RTL locale helper marks Arabic", () => {
        expect(isRtlLocale("ar")).toBe(true);
        expect(isRtlLocale("de")).toBe(false);
    });
});
