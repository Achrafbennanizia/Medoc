import { describe, expect, it } from "vitest";
import en from "../../locales/en.json";
import { breadcrumbKeysForPath } from "./breadcrumb-keys";
import { getAdministrationBackTarget } from "./administration-hierarchy";

const ADMIN_PATHS = [
    "/administration", "/administration/team", "/administration/team/work-time", "/administration/finance-reports",
    "/administration/finance-reports/day-close", "/administration/finance-reports/invoice", "/administration/inventory-and-ordering",
    "/administration/contracts", "/administration/order-master", "/administration/services-catalogs-templates",
    "/administration/treatment-catalog", "/administration/templates", "/administration/templates/editor/x",
    "/administration/practice-planning", "/administration/work-days", "/administration/work-hours",
    "/administration/special-blocked-times", "/administration/practice-preferences", "/administration/sick-leave-certificate",
    "/administration/medications", "/administration/prescription-presets",
];
const dict = en as Record<string, string>;

describe("administration breadcrumbs", () => {
    it.each(ADMIN_PATHS)("%s uses only existing translation keys", (p) => {
        for (const k of breadcrumbKeysForPath(p)) expect(dict[k], `${p} → ${k}`).toBeTypeOf("string");
    });
    it("practice planning pages show their hub, like the Back button", () => {
        for (const p of ["/administration/work-hours", "/administration/practice-preferences", "/administration/special-blocked-times"]) {
            expect(getAdministrationBackTarget(p).path).toBe("/administration/practice-planning");
            expect(breadcrumbKeysForPath(p)).toContain("palette.cmd.administration-practice-planning");
        }
    });
});
