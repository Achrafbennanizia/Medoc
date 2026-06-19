import { describe, expect, it } from "vitest";
import { NAV_ITEM_DEFINITIONS } from "./rbac";
import { NAV_SECTIONS } from "./nav-sections";
import { POSTEINGANG_UI_ENABLED } from "./posteingang-config";

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
        for (const path of ["/tickets", "/patienten", "/rezepte", "/leistungen", "/produkte"]) {
            expect(defined.has(path)).toBe(true);
        }
        if (POSTEINGANG_UI_ENABLED) {
            expect(defined.has("/posteingang")).toBe(true);
        } else {
            expect(defined.has("/posteingang")).toBe(false);
        }
    });

    it("Behandlung includes posteingang before tickets when UI enabled (G21 row 1)", () => {
        const behandlung = NAV_SECTIONS.find((s) => s.labelKey === "nav.section.clinical");
        expect(behandlung).toBeDefined();
        const items = behandlung!.items;
        if (POSTEINGANG_UI_ENABLED) {
            expect(items).toContain("/posteingang");
            expect(items.indexOf("/posteingang")).toBeLessThan(items.indexOf("/tickets"));
        } else {
            expect(items).not.toContain("/posteingang");
            expect(items).toContain("/tickets");
        }
    });

    it("Praxis sidebar omits tagesabschluss (reachable via Verwaltung → Finanzen & Berichte)", () => {
        const praxis = NAV_SECTIONS.find((s) => s.labelKey === "nav.section.practice");
        expect(praxis).toBeDefined();
        expect(praxis!.items).not.toContain("/verwaltung/finanzen-berichte/tagesabschluss");
    });
});
