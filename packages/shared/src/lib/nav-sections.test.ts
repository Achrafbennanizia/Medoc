import { describe, expect, it } from "vitest";
import { NAV_ITEM_DEFINITIONS } from "./rbac";
import { NAV_SECTIONS } from "./nav-sections";
import { INBOX_UI_ENABLED } from "./inbox-config";
import {
    SERVICES_MENU_ENABLED,
    PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED,
} from "./catalog-menu-flags";

describe("NAV_SECTIONS (G17 sidebar regression)", () => {
    it("every sidebar path is defined in rbac nav items", () => {
        const defined = new Set(NAV_ITEM_DEFINITIONS.map((i) => i.to));
        for (const section of NAV_SECTIONS) {
            for (const path of section.items) {
                expect(defined.has(path), `missing NAV_ITEM_DEFINITIONS for ${path}`).toBe(true);
            }
        }
    });

    it("G21-critical sidebar paths are defined in rbac nav items", () => {
        const defined = new Set(NAV_ITEM_DEFINITIONS.map((i) => i.to));
        for (const path of ["/tickets", "/patients"]) {
            expect(defined.has(path)).toBe(true);
        }
        if (PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED) {
            expect(defined.has("/prescriptions")).toBe(true);
        } else {
            expect(defined.has("/prescriptions")).toBe(false);
        }
        if (SERVICES_MENU_ENABLED) {
            expect(defined.has("/services")).toBe(true);
        } else {
            expect(defined.has("/services")).toBe(false);
        }
        expect(defined.has("/products")).toBe(false);
        if (INBOX_UI_ENABLED) {
            expect(defined.has("/inbox")).toBe(true);
        } else {
            expect(defined.has("/inbox")).toBe(false);
        }
    });

    it("Treatment includes inbox before tickets when UI enabled (G21 row 1)", () => {
        const treatment = NAV_SECTIONS.find((s) => s.labelKey === "nav.section.clinical");
        expect(treatment).toBeDefined();
        const items = treatment!.items;
        if (INBOX_UI_ENABLED) {
            expect(items).toContain("/inbox");
            expect(items.indexOf("/inbox")).toBeLessThan(items.indexOf("/tickets"));
        } else {
            expect(items).not.toContain("/inbox");
            expect(items).toContain("/tickets");
        }
    });

    it("Practice sidebar omits day_close (reachable via Administration → Finance & reports)", () => {
        const practice = NAV_SECTIONS.find((s) => s.labelKey === "nav.section.practice");
        expect(practice).toBeDefined();
        expect(practice!.items).not.toContain("/administration/finance-reports/day-close");
    });
});
