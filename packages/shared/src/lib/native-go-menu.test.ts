import { describe, expect, it } from "vitest";
import { buildNativeGoMenuItems, buildNativeFileNewGate, NATIVE_GO_MENU_SEP } from "./native-go-menu";
import { LEISTUNGEN_MENU_ENABLED } from "./catalog-menu-flags";

const id = (key: string) => key;

describe("buildNativeGoMenuItems", () => {
    // TODO(deferred-roles): Steuerberater / Pharmaberater native menu — todos-deferred-roles.md
    it("deferred advisor roles get empty native go menu", () => {
        expect(buildNativeGoMenuItems("STEUERBERATER", id)).toEqual([]);
        expect(buildNativeGoMenuItems("PHARMABERATER", id)).toEqual([]);
    });

    it("buildNativeFileNewGate: deferred advisor roles denied", () => {
        const g = buildNativeFileNewGate("STEUERBERATER");
        expect(g.termin).toBe(false);
        expect(g.patient).toBe(false);
        expect(g.zahlung).toBe(false);
        expect(g.bilanz).toBe(false);
    });

    it("buildNativeFileNewGate: physician has New menu for appointment and patient", () => {
        const g = buildNativeFileNewGate("ARZT");
        expect(g.termin).toBe(true);
        expect(g.patient).toBe(true);
        expect(g.leistung).toBe(LEISTUNGEN_MENU_ENABLED);
        expect(g.bilanz).toBe(true);
    });

    it("Physician: includes Audit and Ops", () => {
        const items = buildNativeGoMenuItems("ARZT", id);
        const paths = items.filter((i) => i.path !== NATIVE_GO_MENU_SEP).map((i) => i.path);
        expect(paths).toContain("/audit");
        expect(paths).toContain("/ops");
    });
});
