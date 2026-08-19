import { describe, expect, it } from "vitest";
import { getAdministrationBackTarget } from "./administration-hierarchy";

describe("getAdministrationBackTarget", () => {
    it("resolves one level: Finance → hub, Tools → Finance", () => {
        expect(getAdministrationBackTarget("/administration/finance-reports").path).toBe("/administration");
        expect(getAdministrationBackTarget("/administration/finance-tools").path).toBe("/administration/finance-reports");
        expect(getAdministrationBackTarget("/administration/day-close").path).toBe("/administration/finance-reports");
        expect(getAdministrationBackTarget("/administration/finance-reports/day-close").path).toBe("/administration/finance-reports");
        expect(getAdministrationBackTarget("/administration/finance-reports/invoice").path).toBe("/administration/finance-reports");
    });

    it("resolves editor → templates list", () => {
        const t = getAdministrationBackTarget("/administration/templates/editor/x");
        expect(t.path).toBe("/administration/templates");
        expect(t.labelKey).toBe("administration.back.templates");
    });

    it("resolves inventory/ subpages → inventory hub", () => {
        expect(getAdministrationBackTarget("/administration/order-master").path).toBe("/administration/inventory-and-ordering");
        expect(getAdministrationBackTarget("/products").path).toBe("/administration/inventory-and-ordering");
    });

    it("resolves service catalog hub children → services hub", () => {
        expect(getAdministrationBackTarget("/administration/templates").path).toBe("/administration/services-catalogs-templates");
        expect(getAdministrationBackTarget("/services").path).toBe("/administration/services-catalogs-templates");
    });

    it("strips query string", () => {
        expect(getAdministrationBackTarget("/administration/templates/editor/new?kind=prescription").path).toBe("/administration/templates");
    });

    it("resolves Administration root → dashboard overview", () => {
        expect(getAdministrationBackTarget("/administration")).toEqual({ path: "/", labelKey: "nav.dashboard" });
    });
});
