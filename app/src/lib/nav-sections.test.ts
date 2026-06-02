import { describe, expect, it } from "vitest";
import { NAV_ITEM_DEFINITIONS } from "./rbac";
import { NAV_SECTIONS } from "./nav-sections";

describe("NAV_SECTIONS (G17 sidebar regression)", () => {
    it("G21-critical sidebar paths are defined in rbac nav items", () => {
        const defined = new Set(NAV_ITEM_DEFINITIONS.map((i) => i.to));
        for (const path of ["/posteingang", "/tickets", "/patienten"]) {
            expect(defined.has(path)).toBe(true);
        }
    });

    it("Behandlung includes posteingang before tickets (G21 row 1)", () => {
        const behandlung = NAV_SECTIONS.find((s) => s.label === "Behandlung");
        expect(behandlung).toBeDefined();
        const items = behandlung!.items;
        expect(items).toContain("/posteingang");
        expect(items.indexOf("/posteingang")).toBeLessThan(items.indexOf("/tickets"));
    });

    it("Praxis includes tagesabschluss after finanzen (GAP-10 REZ IA)", () => {
        const praxis = NAV_SECTIONS.find((s) => s.label === "Praxis");
        expect(praxis).toBeDefined();
        const items = praxis!.items;
        expect(items).toContain("/verwaltung/finanzen-berichte/tagesabschluss");
        expect(items.indexOf("/verwaltung/finanzen-berichte/tagesabschluss")).toBeGreaterThan(
            items.indexOf("/finanzen"),
        );
    });
});
