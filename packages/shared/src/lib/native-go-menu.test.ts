import { describe, expect, it } from "vitest";
import { buildNativeGoMenuItems, buildNativeFileNewGate, NATIVE_GO_MENU_SEP } from "./native-go-menu";
import { SERVICES_MENU_ENABLED } from "./catalog-menu-flags";

const id = (key: string) => key;

describe("buildNativeGoMenuItems", () => {
    // TODO(deferred-roles): TaxAdvisor / PharmaConsultant native menu — todos-deferred-roles.md
    it("deferred advisor roles get empty native go menu", () => {
        expect(buildNativeGoMenuItems("TAX_ADVISOR", id)).toEqual([]);
        expect(buildNativeGoMenuItems("PHARMA_CONSULTANT", id)).toEqual([]);
    });

    it("buildNativeFileNewGate: deferred advisor roles denied", () => {
        const g = buildNativeFileNewGate("TAX_ADVISOR");
        expect(g.appointment).toBe(false);
        expect(g.patient).toBe(false);
        expect(g.payment).toBe(false);
        expect(g.balance_sheet).toBe(false);
    });

    it("buildNativeFileNewGate: physician has New menu for appointment and patient", () => {
        const g = buildNativeFileNewGate("PHYSICIAN");
        expect(g.appointment).toBe(true);
        expect(g.patient).toBe(true);
        expect(g.service_item).toBe(SERVICES_MENU_ENABLED);
        expect(g.balance_sheet).toBe(true);
    });

    it("Physician: includes Audit and Ops", () => {
        const items = buildNativeGoMenuItems("PHYSICIAN", id);
        const paths = items.filter((i) => i.path !== NATIVE_GO_MENU_SEP).map((i) => i.path);
        expect(paths).toContain("/audit");
        expect(paths).toContain("/ops");
    });
});
