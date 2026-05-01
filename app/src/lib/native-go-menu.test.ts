import { describe, expect, it } from "vitest";
import { buildNativeGoMenuItems, buildNativeFileNewGate, NATIVE_GO_MENU_SEP } from "./native-go-menu";

const id = (key: string) => key;

describe("buildNativeGoMenuItems", () => {
    it("Steuerberater: Finanzen & Statistik, kein Patientenbereich", () => {
        const items = buildNativeGoMenuItems("STEUERBERATER", id);
        const paths = items.filter((i) => i.path !== NATIVE_GO_MENU_SEP).map((i) => i.path);
        expect(paths).toContain("/finanzen");
        expect(paths).toContain("/statistik");
        expect(paths).toContain("/bilanz");
        expect(paths).not.toContain("/patienten");
        expect(paths).not.toContain("/termine");
    });

    it("Pharmaberater: Dashboard, keine Patientenakten (Termine/Rezeptpfade gesperrt)", () => {
        const items = buildNativeGoMenuItems("PHARMABERATER", id);
        const paths = items.filter((i) => i.path !== NATIVE_GO_MENU_SEP).map((i) => i.path);
        expect(paths).toContain("/");
        expect(paths).not.toContain("/termine");
        expect(paths).not.toContain("/patienten");
    });

    it("buildNativeFileNewGate: Steuerberater darf keine neuen Termine/Patienten", () => {
        const g = buildNativeFileNewGate("STEUERBERATER");
        expect(g.termin).toBe(false);
        expect(g.patient).toBe(false);
        expect(g.zahlung).toBe(true);
    });

    it("buildNativeFileNewGate: Arzt hat Neu-Menü für Termin und Patient", () => {
        const g = buildNativeFileNewGate("ARZT");
        expect(g.termin).toBe(true);
        expect(g.patient).toBe(true);
        expect(g.leistung).toBe(true);
        expect(g.bilanz).toBe(true);
    });

    it("Arzt: enthält Audit und Ops", () => {
        const items = buildNativeGoMenuItems("ARZT", id);
        const paths = items.filter((i) => i.path !== NATIVE_GO_MENU_SEP).map((i) => i.path);
        expect(paths).toContain("/audit");
        expect(paths).toContain("/ops");
    });
});
