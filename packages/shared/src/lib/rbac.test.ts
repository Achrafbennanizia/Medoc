import { describe, expect, it } from "vitest";
import {
    allowed,
    navItemVisible,
    NAV_ITEM_DEFINITIONS,
    parseRole,
    resolveRoutePathFromLocation,
    routeChildPathAllowed,
    routeLocationAllowed,
    ROUTE_VISIBILITY,
    settingsSectionVisible,
    type Role,
} from "./rbac";
import { PRIVACY_UI_ENABLED } from "./privacy-config";
import { INBOX_UI_ENABLED } from "./inbox-config";
import {
    SERVICES_MENU_ENABLED,
    PRODUCTS_MENU_ENABLED,
    PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED,
} from "./catalog-menu-flags";
import {
    NOTIFICATIONS_SETTINGS_ENABLED,
    INTEGRATIONS_SETTINGS_ENABLED,
    MIGRATION_SETTINGS_ENABLED,
} from "./settings-ui-flags";
import { ACTIVE_ROLE_WIRES } from "./deferred-roles";

const ROLES = ACTIVE_ROLE_WIRES satisfies readonly Role[];

const ADMINISTRATION_ROUTE_KEYS = [
    "administration",
    "administration/team",
    "administration/team/work-time",
    "administration/work-days",
    "administration/practice-planning",
    "administration/work-hours",
    "administration/special-blocked-times",
    "administration/practice-preferences",
    "administration/templates",
    "administration/templates/editor",
    "administration/treatment-catalog",
    "administration/order-master",
    "administration/finance-tools",
    "administration/day-close",
    "administration/finance-reports",
    "administration/finance-reports/day-close",
    "administration/finance-reports/invoice",
    "administration/inventory-and-ordering",
    "administration/contracts",
    "administration/services-catalogs-templates",
] as const satisfies ReadonlyArray<keyof typeof ROUTE_VISIBILITY>;

/** Spec matrix: role × Administration subroute → routeChildPathAllowed (mirrors ROUTE_VISIBILITY + allowed()). */
const ADMINISTRATION_ROUTE_EXPECTED: Record<Role, Record<(typeof ADMINISTRATION_ROUTE_KEYS)[number], boolean>> = {
    PHYSICIAN: {
        "administration": true,
        "administration/team": true,
        "administration/team/work-time": true,
        "administration/work-days": true,
        "administration/practice-planning": true,
        "administration/work-hours": true,
        "administration/special-blocked-times": true,
        "administration/practice-preferences": true,
        "administration/templates": PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED,
        "administration/templates/editor": PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED,
        "administration/treatment-catalog": true,
        "administration/order-master": true,
        "administration/finance-tools": true,
        "administration/day-close": true,
        "administration/finance-reports": true,
        "administration/finance-reports/day-close": true,
        "administration/finance-reports/invoice": true,
        "administration/inventory-and-ordering": true,
        "administration/contracts": true,
        "administration/services-catalogs-templates": true,
    },
    RECEPTION: {
        "administration": false,
        "administration/team": false,
        "administration/team/work-time": false,
        "administration/work-days": false,
        "administration/practice-planning": false,
        "administration/work-hours": false,
        "administration/special-blocked-times": false,
        "administration/practice-preferences": false,
        "administration/templates": false,
        "administration/templates/editor": false,
        "administration/treatment-catalog": false,
        "administration/order-master": false,
        "administration/finance-tools": false,
        "administration/day-close": false,
        "administration/finance-reports": false,
        "administration/finance-reports/day-close": false,
        "administration/finance-reports/invoice": false,
        "administration/inventory-and-ordering": false,
        "administration/contracts": false,
        "administration/services-catalogs-templates": false,
    },
    // TODO(deferred-roles): TAX_ADVISOR / PHARMA_CONSULTANT — see docs/coordination/todos-deferred-roles.md
};

describe("parseRole", () => {
    it("accepts known roles", () => {
        expect(parseRole("PHYSICIAN")).toBe("PHYSICIAN");
        expect(parseRole("RECEPTION")).toBe("RECEPTION");
    });
    it("rejects unknown and deferred advisor roles", () => {
        expect(parseRole("ADMIN")).toBeNull();
        expect(parseRole(undefined)).toBeNull();
        expect(parseRole("TAX_ADVISOR")).toBeNull();
        expect(parseRole("PHARMA_CONSULTANT")).toBeNull();
    });
});

describe("allowed (mirror of Rust rbac::allowed)", () => {
    it("Reception cannot read medical or audit", () => {
        expect(allowed("patient.read_medical", "RECEPTION")).toBe(false);
        expect(allowed("audit.read", "RECEPTION")).toBe(false);
    });
    it("purchase_order.write mirrors Rust (PHYSICIAN + RECEPTION)", () => {
        expect(allowed("purchase_order.write", "PHYSICIAN")).toBe(true);
        expect(allowed("purchase_order.write", "RECEPTION")).toBe(true);
    });
    it("templates.read/write mirror staff scope (Physician only)", () => {
        expect(allowed("templates.read", "PHYSICIAN")).toBe(true);
        expect(allowed("templates.write", "PHYSICIAN")).toBe(true);
        expect(allowed("templates.read", "RECEPTION")).toBe(false);
        expect(allowed("templates.write", "RECEPTION")).toBe(false);
    });
    it("administration.templates.* matches templates (Physician only)", () => {
        expect(allowed("administration.templates.read", "PHYSICIAN")).toBe(true);
        expect(allowed("administration.templates.read", "RECEPTION")).toBe(false);
    });
    it("administration.inventory.write for RECEPTION", () => {
        expect(allowed("administration.inventory.write", "RECEPTION")).toBe(true);
    });
    it("finance.day_close.write Physician only (deferred TaxAdvisor)", () => {
        expect(allowed("finance.day_close.write", "PHYSICIAN")).toBe(true);
        expect(allowed("finance.day_close.write", "RECEPTION")).toBe(false);
    });
    it("patient.treatments_list_for_payment matches billing roles (mirrors Rust)", () => {
        expect(allowed("patient.treatments_list_for_payment", "PHYSICIAN")).toBe(true);
        expect(allowed("patient.treatments_list_for_payment", "RECEPTION")).toBe(true);
    });
    it("patient.read_documents matches Rust (PHYSICIAN + RECEPTION)", () => {
        expect(allowed("patient.read_documents", "PHYSICIAN")).toBe(true);
        expect(allowed("patient.read_documents", "RECEPTION")).toBe(true);
    });
});

describe("routeChildPathAllowed", () => {
    it("Administration subroutes: every role × every route (spec matrix)", () => {
        for (const role of ROLES) {
            for (const path of ADMINISTRATION_ROUTE_KEYS) {
                const want = ADMINISTRATION_ROUTE_EXPECTED[role][path];
                expect(routeChildPathAllowed(path, role), `${role} ${path}`).toBe(want);
            }
        }
    });
    it("allows patient detail when patients list allowed", () => {
        expect(routeChildPathAllowed("patients/:id", "RECEPTION")).toBe(true);
    });
    it("denies unknown route key", () => {
        expect(routeChildPathAllowed("unknown", "PHYSICIAN")).toBe(false);
    });
    it("allows purchase-orders with purchase_order.read (active roles)", () => {
        expect(routeChildPathAllowed("purchase-orders", "RECEPTION")).toBe(true);
        expect(routeChildPathAllowed("purchase-orders", "PHYSICIAN")).toBe(true);
    });
    it("allows purchase-orders/new only with purchase_order.write", () => {
        expect(routeChildPathAllowed("purchase-orders/new", "PHYSICIAN")).toBe(true);
        expect(routeChildPathAllowed("purchase-orders/new", "RECEPTION")).toBe(true);
    });
    it("allows migration only for Physician", () => {
        expect(routeChildPathAllowed("migration", "PHYSICIAN")).toBe(true);
        expect(routeChildPathAllowed("migration", "RECEPTION")).toBe(false);
    });
    it("allows help and feedback for active roles", () => {
        expect(routeChildPathAllowed("help", "PHYSICIAN")).toBe(true);
        expect(routeChildPathAllowed("feedback", "RECEPTION")).toBe(true);
    });
    it("allows appointments/new for roles with appointment.write", () => {
        expect(routeChildPathAllowed("appointments/new", "PHYSICIAN")).toBe(true);
        expect(routeChildPathAllowed("appointments/new", "RECEPTION")).toBe(true);
    });
    it("allows balance-sheet/new for Physician only (deferred TaxAdvisor)", () => {
        expect(routeChildPathAllowed("balance-sheet/new", "PHYSICIAN")).toBe(true);
        expect(routeChildPathAllowed("balance-sheet/new", "RECEPTION")).toBe(false);
    });
    it("allows charts to validate only for Physician (patient.read_medical)", () => {
        expect(routeChildPathAllowed("charts/to-validate", "PHYSICIAN")).toBe(true);
        expect(routeChildPathAllowed("charts/to-validate", "RECEPTION")).toBe(false);
    });
    it("allows tickets for Physician and Reception only", () => {
        expect(routeChildPathAllowed("tickets", "PHYSICIAN")).toBe(true);
        expect(routeChildPathAllowed("tickets", "RECEPTION")).toBe(true);
    });
    it("denies routes for deferred advisor wire strings", () => {
        expect(routeChildPathAllowed("tickets", "TAX_ADVISOR")).toBe(false);
        expect(routeChildPathAllowed("tickets", "PHARMA_CONSULTANT")).toBe(false);
    });
    it("inbox route respects INBOX_UI_ENABLED", () => {
        if (INBOX_UI_ENABLED) {
            expect(routeChildPathAllowed("inbox", "PHYSICIAN")).toBe(true);
            expect(routeChildPathAllowed("inbox", "RECEPTION")).toBe(true);
        } else {
            expect(routeChildPathAllowed("inbox", "PHYSICIAN")).toBe(false);
            expect(routeChildPathAllowed("inbox", "RECEPTION")).toBe(false);
        }
        expect(routeChildPathAllowed("administration/tasks", "PHYSICIAN")).toBe(true);
    });
    it("privacy route respects PRIVACY_UI_ENABLED", () => {
        if (PRIVACY_UI_ENABLED) {
            expect(routeChildPathAllowed("privacy", "PHYSICIAN")).toBe(true);
        } else {
            expect(routeChildPathAllowed("privacy", "PHYSICIAN")).toBe(false);
        }
    });
    it("catalog menu routes respect catalog-menu-flags", () => {
        if (PRESCRIPTIONS_CERTIFICATES_MENU_ENABLED) {
            expect(routeChildPathAllowed("prescriptions", "PHYSICIAN")).toBe(true);
            expect(routeChildPathAllowed("administration/templates", "PHYSICIAN")).toBe(true);
        } else {
            expect(routeChildPathAllowed("prescriptions", "PHYSICIAN")).toBe(false);
            expect(routeChildPathAllowed("administration/templates", "PHYSICIAN")).toBe(false);
        }
        if (SERVICES_MENU_ENABLED) {
            expect(routeChildPathAllowed("services", "PHYSICIAN")).toBe(true);
        } else {
            expect(routeChildPathAllowed("services", "PHYSICIAN")).toBe(false);
        }
        if (PRODUCTS_MENU_ENABLED) {
            expect(routeChildPathAllowed("products", "PHYSICIAN")).toBe(true);
        } else {
            expect(routeChildPathAllowed("products", "PHYSICIAN")).toBe(false);
        }
    });
    it("GAP-01: RECEPTION cannot read medical records action", () => {
        expect(allowed("patient.read_medical", "RECEPTION")).toBe(false);
        expect(allowed("patient.treatments_list_for_payment", "RECEPTION")).toBe(true);
    });
});

describe("resolveRoutePathFromLocation", () => {
    it("maps dynamic patient paths to ROUTE_VISIBILITY keys", () => {
        expect(resolveRoutePathFromLocation("/patients/p-42")).toBe("patients/:id");
        expect(resolveRoutePathFromLocation("/patients/p-42/prescription/new")).toBe("patients/:id/prescription/new");
    });

    it("routeLocationAllowed uses resolved keys", () => {
        expect(routeLocationAllowed("/patients/p-1", "RECEPTION")).toBe(true);
        expect(routeLocationAllowed("/charts/to-validate", "RECEPTION")).toBe(false);
    });
});

describe("settingsSectionVisible", () => {
    it("hides admin-only Settings panels for RECEPTION", () => {
        expect(settingsSectionVisible("migration", "RECEPTION")).toBe(false);
        expect(settingsSectionVisible("system", "RECEPTION")).toBe(false);
        expect(settingsSectionVisible("license", "RECEPTION")).toBe(false);
        expect(settingsSectionVisible("integrations", "RECEPTION")).toBe(false);
        expect(settingsSectionVisible("practice", "RECEPTION")).toBe(false);
        expect(settingsSectionVisible("security", "RECEPTION")).toBe(false);
        expect(settingsSectionVisible("account", "RECEPTION")).toBe(true);
        expect(settingsSectionVisible("appearance", "RECEPTION")).toBe(true);
        expect(settingsSectionVisible("workflows", "RECEPTION")).toBe(true);
        expect(settingsSectionVisible("about", "RECEPTION")).toBe(true);
    });

    it("notifications settings respects NOTIFICATIONS_SETTINGS_ENABLED", () => {
        if (NOTIFICATIONS_SETTINGS_ENABLED) {
            expect(settingsSectionVisible("notifications", "RECEPTION")).toBe(true);
            expect(settingsSectionVisible("notifications", "PHYSICIAN")).toBe(true);
        } else {
            expect(settingsSectionVisible("notifications", "RECEPTION")).toBe(false);
            expect(settingsSectionVisible("notifications", "PHYSICIAN")).toBe(false);
        }
    });

    it("shows practice and security for PHYSICIAN", () => {
        expect(settingsSectionVisible("practice", "PHYSICIAN")).toBe(true);
        expect(settingsSectionVisible("security", "PHYSICIAN")).toBe(true);
        expect(settingsSectionVisible("license", "PHYSICIAN")).toBe(true);
        if (INTEGRATIONS_SETTINGS_ENABLED) {
            expect(settingsSectionVisible("integrations", "PHYSICIAN")).toBe(true);
        } else {
            expect(settingsSectionVisible("integrations", "PHYSICIAN")).toBe(false);
        }
        if (MIGRATION_SETTINGS_ENABLED) {
            expect(settingsSectionVisible("migration", "PHYSICIAN")).toBe(true);
        } else {
            expect(settingsSectionVisible("migration", "PHYSICIAN")).toBe(false);
        }
    });
});

describe("navItemVisible", () => {
    it("uses anyOf for compliance", () => {
        const item = {
            to: "/compliance",
            labelKey: "nav.compliance",
            visibility: { kind: "anyOf" as const, actions: ["ops.dsgvo", "ops.system"] },
        };
        expect(navItemVisible("PHYSICIAN", item)).toBe(true);
        expect(navItemVisible("RECEPTION", item)).toBe(false);
    });
    it("Administration nav uses administration.read (not RECEPTION)", () => {
        const item = NAV_ITEM_DEFINITIONS.find((i) => i.to === "/administration");
        expect(item).toBeDefined();
        expect(navItemVisible("RECEPTION", item!)).toBe(false);
        expect(navItemVisible("PHYSICIAN", item!)).toBe(true);
    });

    it("RECEPTION: cash receipts instead of finance/day-end", () => {
        expect(routeChildPathAllowed("finance", "RECEPTION")).toBe(false);
        expect(routeChildPathAllowed("finance/cash", "RECEPTION")).toBe(true);
        expect(routeChildPathAllowed("finance/cash/new", "RECEPTION")).toBe(true);
        expect(routeChildPathAllowed("administration/finance-reports/day-close", "RECEPTION")).toBe(false);
        expect(navItemVisible("RECEPTION", NAV_ITEM_DEFINITIONS.find((i) => i.to === "/finance/cash")!)).toBe(true);
        expect(navItemVisible("RECEPTION", NAV_ITEM_DEFINITIONS.find((i) => i.to === "/finance")!)).toBe(false);
    });

    it("N6: RECEPTION has no Administration routes", () => {
        expect(routeChildPathAllowed("administration/practice-planning", "RECEPTION")).toBe(false);
        expect(routeChildPathAllowed("administration/work-hours", "RECEPTION")).toBe(false);
        expect(routeChildPathAllowed("administration/team", "RECEPTION")).toBe(false);
        expect(routeChildPathAllowed("administration/team/work-time", "RECEPTION")).toBe(false);
        expect(routeChildPathAllowed("staff", "RECEPTION")).toBe(false);
        expect(routeChildPathAllowed("administration/treatment-catalog", "RECEPTION")).toBe(false);
        expect(routeChildPathAllowed("administration/finance-reports/day-close", "RECEPTION")).toBe(false);
    });
});
