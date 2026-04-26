import { describe, expect, it } from "vitest";
import { getVerwaltungBackTarget } from "./verwaltung-hierarchy";

describe("getVerwaltungBackTarget", () => {
    it("resolves one level: Finanzen → hub, Werkzeuge → Finanzen", () => {
        expect(getVerwaltungBackTarget("/verwaltung/finanzen-berichte").path).toBe("/verwaltung");
        expect(getVerwaltungBackTarget("/verwaltung/finanzen-werkzeuge").path).toBe("/verwaltung/finanzen-berichte");
        expect(getVerwaltungBackTarget("/verwaltung/tagesabschluss").path).toBe("/verwaltung/finanzen-berichte");
        expect(getVerwaltungBackTarget("/verwaltung/finanzen-berichte/tagesabschluss").path).toBe("/verwaltung/finanzen-berichte");
        expect(getVerwaltungBackTarget("/verwaltung/finanzen-berichte/rechnung").path).toBe("/verwaltung/finanzen-berichte");
    });

    it("resolves editor → vorlagen list", () => {
        const t = getVerwaltungBackTarget("/verwaltung/vorlagen/editor/x");
        expect(t.path).toBe("/verwaltung/vorlagen");
        expect(t.label).toBe("Vorlagen");
    });

    it("resolves lager/ subpages → lager hub", () => {
        expect(getVerwaltungBackTarget("/verwaltung/bestellstamm").path).toBe("/verwaltung/lager-und-bestellwesen");
        expect(getVerwaltungBackTarget("/produkte").path).toBe("/verwaltung/lager-und-bestellwesen");
    });

    it("resolves leistung hub children → leistungen hub", () => {
        expect(getVerwaltungBackTarget("/verwaltung/vorlagen").path).toBe("/verwaltung/leistungen-kataloge-vorlagen");
        expect(getVerwaltungBackTarget("/leistungen").path).toBe("/verwaltung/leistungen-kataloge-vorlagen");
    });

    it("strips query string", () => {
        expect(getVerwaltungBackTarget("/verwaltung/vorlagen/editor/new?kind=rezept").path).toBe("/verwaltung/vorlagen");
    });
});
