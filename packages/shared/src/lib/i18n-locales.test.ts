import { describe, expect, it } from "vitest";
import {
    localeCatalogKeys,
    translateLocale,
    translateLocaleParams,
    translatePluralUnit,
    pluralCategory,
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

    it("interpolates {{count}} without leaving braces (notifications task link)", () => {
        expect(translateLocaleParams("en", "app.notifications.show_tasks_count", { count: 15 })).toBe(
            "My tasks (15)",
        );
        expect(translateLocaleParams("ar", "app.notifications.show_tasks_count", { count: 15 })).toBe(
            "مهامي (15)",
        );
        expect(translateLocaleParams("en", "app.notifications.show_tasks_count", { count: 15 })).not.toContain("{");
    });

    it("pairing confirmation code keeps western digits in Arabic", () => {
        const shown = translateLocaleParams("ar", "settings.pairing.confirm_code", { pin: "0482" });
        expect(shown).toContain("0482");
        expect(shown).not.toMatch(/[٠-٩۰-۹]/);
    });

    it("plural units inflect calendar days and payments", () => {
        expect(translatePluralUnit("en", "document.print.day_unit", 1)).toBe("calendar day");
        expect(translatePluralUnit("en", "document.print.day_unit", 5)).toBe("calendar days");
        expect(translatePluralUnit("de", "document.print.day_unit", 1)).toBe("Kalendertag");
        expect(translatePluralUnit("de", "document.print.day_unit", 5)).toBe("Kalendertage");
        expect(translatePluralUnit("fr", "document.print.day_unit", 1)).toBe("jour calendaire");
        expect(translatePluralUnit("fr", "document.print.day_unit", 5)).toBe("jours calendaires");
        expect(translatePluralUnit("ar", "document.print.day_unit", 1)).toBe("يوم");
        expect(translatePluralUnit("ar", "document.print.day_unit", 2)).toBe("يومان");
        expect(translatePluralUnit("ar", "document.print.day_unit", 5)).toBe("أيام");
        expect(translatePluralUnit("ar", "document.print.day_unit", 11)).toBe("يوماً");
        expect(translatePluralUnit("ar", "document.print.day_unit", 0)).toBe("يوم");
        expect(pluralCategory("ar", 0)).toBe("zero");
        expect(pluralCategory("ar", 11)).toBe("many");
        expect(pluralCategory("ar", 100)).toBe("other");
        expect(translatePluralUnit("de", "page.finance_cash.payment_unit", 2)).toBe("Zahlungen");
        expect(translateLocaleParams("ar", "document.print.validity_period", {
            from: "1",
            to: "5",
            days: 5,
            unit: translatePluralUnit("ar", "document.print.day_unit", 5),
        })).toContain("5 أيام");
        expect(translateLocaleParams("de", "document.print.validity_period", {
            from: "1",
            to: "5",
            days: 5,
            unit: translatePluralUnit("de", "document.print.day_unit", 5),
        })).toContain("5 Kalendertage");
        expect(translateLocaleParams("ar", "document.print.validity_period", {
            from: "1",
            to: "5",
            days: 5,
            unit: translatePluralUnit("ar", "document.print.day_unit", 5),
        })).not.toMatch(/s/);
        expect(translatePluralUnit("ar", "page.finance_cash.payment_unit", 3)).toBe("دفعات");
        expect(translatePluralUnit("ar", "page.finance_cash.payment_unit", 11)).toBe("دفعة");
    });

    it("all notification list keys resolve in all four locales", () => {
        const keys = [
            "app.notifications.title",
            "app.notifications.empty",
            "app.notifications.mark_all_read",
            "app.notifications.marked_all",
            "app.notifications.show_dashboard",
            "app.notifications.show_tasks",
            "app.notifications.show_tasks_count",
            "app.notifications.task_open",
            "app.notifications.task_returned",
            "app.notifications.task_needs_validation",
            "app.notifications.task_assigned_title",
            "app.notifications.task_assigned_body_fallback",
            "app.notifications.task_done_title",
            "app.notifications.task_done_body_fallback",
            "app.notifications.task_back_title",
            "app.notifications.task_back_body_fallback",
            "app.notifications.plan_hint_title",
            "app.notifications.plan_hint_body",
            "app.notifications.chart_forward_title",
            "app.notifications.chart_forward_body",
            "app.notifications.chart_forward_body_note",
            "app.notifications.ticket_title",
            "app.notifications.outside_hours_summary_title",
            "app.notifications.outside_hours_summary_body",
            "app.notifications.outside_hours_item_title",
            "app.notifications.outside_hours_item_body",
            "app.notifications.outside_hours_item_body_reason",
            "app.notifications.outside_hours_toast",
            "app.notifications.outside_hours_reason.outside_hours",
            "app.notifications.outside_hours_reason.break",
            "app.notifications.outside_hours_reason.closure",
            "app.notifications.outside_hours_reason.absence",
            "app.notifications.seed.PRACTICE_TASK.title",
            "app.notifications.seed.PRACTICE_TASK.body",
            "app.notifications.seed.TICKET.title",
            "app.notifications.seed.TICKET.body",
            "app.notifications.seed.APPOINTMENT.title",
            "app.notifications.seed.APPOINTMENT.body",
            "app.notifications.seed.STOCK.title",
            "app.notifications.seed.STOCK.body",
            "app.notifications.seed.SYSTEM.title",
            "app.notifications.seed.SYSTEM.body",
            "appointments.scheduling.outside_hours",
            "appointments.scheduling.absence",
        ] as const;
        const arabicRe = /[\u0600-\u06FF]/;
        for (const loc of LOCALES) {
            for (const key of keys) {
                const text = translateLocale(loc, key);
                expect(text, `${loc}:${key}`).not.toBe(key);
                expect(text.trim().length, `${loc}:${key} empty`).toBeGreaterThan(0);
            }
        }
        expect(arabicRe.test(translateLocale("ar", "app.notifications.plan_hint_title"))).toBe(true);
        expect(arabicRe.test(translateLocale("ar", "app.notifications.seed.STOCK.title"))).toBe(true);
        expect(
            translateLocaleParams("de", "app.notifications.task_assigned_title", { label: "Ada" }),
        ).toContain("Neue Aufgabe");
        expect(
            translateLocaleParams("fr", "app.notifications.outside_hours_toast", { count: 2 }),
        ).not.toMatch(/\bNotifications\b/);
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
