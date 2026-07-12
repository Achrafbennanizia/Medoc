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
import { DATENSCHUTZ_UI_ENABLED } from "./datenschutz-config";
import { POSTEINGANG_UI_ENABLED } from "./posteingang-config";
import {
    LEISTUNGEN_MENU_ENABLED,
    PRODUKTE_MENU_ENABLED,
    REZEPTE_ATTESTE_MENU_ENABLED,
} from "./catalog-menu-flags";
import {
    BENACHRICHTIGUNGEN_SETTINGS_ENABLED,
    INTEGRATIONEN_SETTINGS_ENABLED,
    MIGRATION_SETTINGS_ENABLED,
} from "./settings-ui-flags";
import { ACTIVE_ROLE_WIRES } from "./deferred-roles";

const ROLES = ACTIVE_ROLE_WIRES satisfies readonly Role[];

const VERWALTUNG_ROUTE_KEYS = [
    "verwaltung",
    "verwaltung/team",
    "verwaltung/team/arbeitszeit",
    "verwaltung/arbeitstage",
    "verwaltung/praxisplanung",
    "verwaltung/arbeitszeiten",
    "verwaltung/sonder-sperrzeiten",
    "verwaltung/praxis-praeferenzen",
    "verwaltung/vorlagen",
    "verwaltung/vorlagen/editor",
    "verwaltung/behandlungs-katalog",
    "verwaltung/bestellstamm",
    "verwaltung/finanzen-werkzeuge",
    "verwaltung/tagesabschluss",
    "verwaltung/finanzen-berichte",
    "verwaltung/finanzen-berichte/tagesabschluss",
    "verwaltung/finanzen-berichte/rechnung",
    "verwaltung/lager-und-bestellwesen",
    "verwaltung/vertraege",
    "verwaltung/leistungen-kataloge-vorlagen",
] as const satisfies ReadonlyArray<keyof typeof ROUTE_VISIBILITY>;

/** Spec matrix: role × Verwaltung subroute → routeChildPathAllowed (mirrors ROUTE_VISIBILITY + allowed()). */
const VERWALTUNG_ROUTE_EXPECTED: Record<Role, Record<(typeof VERWALTUNG_ROUTE_KEYS)[number], boolean>> = {
    ARZT: {
        verwaltung: true,
        "verwaltung/team": true,
        "verwaltung/team/arbeitszeit": true,
        "verwaltung/arbeitstage": true,
        "verwaltung/praxisplanung": true,
        "verwaltung/arbeitszeiten": true,
        "verwaltung/sonder-sperrzeiten": true,
        "verwaltung/praxis-praeferenzen": true,
        "verwaltung/vorlagen": REZEPTE_ATTESTE_MENU_ENABLED,
        "verwaltung/vorlagen/editor": REZEPTE_ATTESTE_MENU_ENABLED,
        "verwaltung/behandlungs-katalog": true,
        "verwaltung/bestellstamm": true,
        "verwaltung/finanzen-werkzeuge": true,
        "verwaltung/tagesabschluss": true,
        "verwaltung/finanzen-berichte": true,
        "verwaltung/finanzen-berichte/tagesabschluss": true,
        "verwaltung/finanzen-berichte/rechnung": true,
        "verwaltung/lager-und-bestellwesen": true,
        "verwaltung/vertraege": true,
        "verwaltung/leistungen-kataloge-vorlagen": true,
    },
    REZEPTION: {
        verwaltung: false,
        "verwaltung/team": false,
        "verwaltung/team/arbeitszeit": false,
        "verwaltung/arbeitstage": false,
        "verwaltung/praxisplanung": false,
        "verwaltung/arbeitszeiten": false,
        "verwaltung/sonder-sperrzeiten": false,
        "verwaltung/praxis-praeferenzen": false,
        "verwaltung/vorlagen": false,
        "verwaltung/vorlagen/editor": false,
        "verwaltung/behandlungs-katalog": false,
        "verwaltung/bestellstamm": false,
        "verwaltung/finanzen-werkzeuge": false,
        "verwaltung/tagesabschluss": false,
        "verwaltung/finanzen-berichte": false,
        "verwaltung/finanzen-berichte/tagesabschluss": false,
        "verwaltung/finanzen-berichte/rechnung": false,
        "verwaltung/lager-und-bestellwesen": false,
        "verwaltung/vertraege": false,
        "verwaltung/leistungen-kataloge-vorlagen": false,
    },
    // TODO(deferred-roles): STEUERBERATER / PHARMABERATER — see docs/coordination/todos-deferred-roles.md
};

describe("parseRole", () => {
    it("accepts known roles", () => {
        expect(parseRole("ARZT")).toBe("ARZT");
        expect(parseRole("REZEPTION")).toBe("REZEPTION");
    });
    it("rejects unknown and deferred advisor roles", () => {
        expect(parseRole("ADMIN")).toBeNull();
        expect(parseRole(undefined)).toBeNull();
        expect(parseRole("STEUERBERATER")).toBeNull();
        expect(parseRole("PHARMABERATER")).toBeNull();
    });
});

describe("allowed (mirror of Rust rbac::allowed)", () => {
    it("Rezeption cannot read medical or audit", () => {
        expect(allowed("patient.read_medical", "REZEPTION")).toBe(false);
        expect(allowed("audit.read", "REZEPTION")).toBe(false);
    });
    it("bestellung.write mirrors Rust (ARZT + REZEPTION)", () => {
        expect(allowed("bestellung.write", "ARZT")).toBe(true);
        expect(allowed("bestellung.write", "REZEPTION")).toBe(true);
    });
    it("vorlagen.read/write mirror personal scope (Arzt only)", () => {
        expect(allowed("vorlagen.read", "ARZT")).toBe(true);
        expect(allowed("vorlagen.write", "ARZT")).toBe(true);
        expect(allowed("vorlagen.read", "REZEPTION")).toBe(false);
        expect(allowed("vorlagen.write", "REZEPTION")).toBe(false);
    });
    it("verwaltung.vorlagen.* matches vorlagen (Arzt only)", () => {
        expect(allowed("verwaltung.vorlagen.read", "ARZT")).toBe(true);
        expect(allowed("verwaltung.vorlagen.read", "REZEPTION")).toBe(false);
    });
    it("verwaltung.lager.write for REZEPTION", () => {
        expect(allowed("verwaltung.lager.write", "REZEPTION")).toBe(true);
    });
    it("finanzen.tagesabschluss.write Arzt only (deferred Steuerberater)", () => {
        expect(allowed("finanzen.tagesabschluss.write", "ARZT")).toBe(true);
        expect(allowed("finanzen.tagesabschluss.write", "REZEPTION")).toBe(false);
    });
    it("patient.behandlungen_list_for_zahlung matches billing roles (mirrors Rust)", () => {
        expect(allowed("patient.behandlungen_list_for_zahlung", "ARZT")).toBe(true);
        expect(allowed("patient.behandlungen_list_for_zahlung", "REZEPTION")).toBe(true);
    });
    it("patient.read_documents matches Rust (ARZT + REZEPTION)", () => {
        expect(allowed("patient.read_documents", "ARZT")).toBe(true);
        expect(allowed("patient.read_documents", "REZEPTION")).toBe(true);
    });
});

describe("routeChildPathAllowed", () => {
    it("Verwaltung subroutes: every role × every route (spec matrix)", () => {
        for (const role of ROLES) {
            for (const path of VERWALTUNG_ROUTE_KEYS) {
                const want = VERWALTUNG_ROUTE_EXPECTED[role][path];
                expect(routeChildPathAllowed(path, role), `${role} ${path}`).toBe(want);
            }
        }
    });
    it("allows patient detail when patienten list allowed", () => {
        expect(routeChildPathAllowed("patienten/:id", "REZEPTION")).toBe(true);
    });
    it("denies unknown route key", () => {
        expect(routeChildPathAllowed("unknown", "ARZT")).toBe(false);
    });
    it("allows bestellungen with bestellung.read (active roles)", () => {
        expect(routeChildPathAllowed("bestellungen", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("bestellungen", "ARZT")).toBe(true);
    });
    it("allows bestellungen/neu only with bestellung.write", () => {
        expect(routeChildPathAllowed("bestellungen/neu", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("bestellungen/neu", "REZEPTION")).toBe(true);
    });
    it("allows migration only for Arzt", () => {
        expect(routeChildPathAllowed("migration", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("migration", "REZEPTION")).toBe(false);
    });
    it("allows hilfe and feedback for active roles", () => {
        expect(routeChildPathAllowed("hilfe", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("feedback", "REZEPTION")).toBe(true);
    });
    it("allows termine/neu for roles with termin.write", () => {
        expect(routeChildPathAllowed("termine/neu", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("termine/neu", "REZEPTION")).toBe(true);
    });
    it("allows bilanz/neu for Arzt only (deferred Steuerberater)", () => {
        expect(routeChildPathAllowed("bilanz/neu", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("bilanz/neu", "REZEPTION")).toBe(false);
    });
    it("allows akten zu validieren only for Arzt (patient.read_medical)", () => {
        expect(routeChildPathAllowed("akten/zu-validieren", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("akten/zu-validieren", "REZEPTION")).toBe(false);
    });
    it("allows tickets for Arzt and Rezeption only", () => {
        expect(routeChildPathAllowed("tickets", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("tickets", "REZEPTION")).toBe(true);
    });
    it("denies routes for deferred advisor wire strings", () => {
        expect(routeChildPathAllowed("tickets", "STEUERBERATER")).toBe(false);
        expect(routeChildPathAllowed("tickets", "PHARMABERATER")).toBe(false);
    });
    it("posteingang route respects POSTEINGANG_UI_ENABLED", () => {
        if (POSTEINGANG_UI_ENABLED) {
            expect(routeChildPathAllowed("posteingang", "ARZT")).toBe(true);
            expect(routeChildPathAllowed("posteingang", "REZEPTION")).toBe(true);
        } else {
            expect(routeChildPathAllowed("posteingang", "ARZT")).toBe(false);
            expect(routeChildPathAllowed("posteingang", "REZEPTION")).toBe(false);
        }
        expect(routeChildPathAllowed("verwaltung/aufgaben", "ARZT")).toBe(true);
    });
    it("datenschutz route respects DATENSCHUTZ_UI_ENABLED", () => {
        if (DATENSCHUTZ_UI_ENABLED) {
            expect(routeChildPathAllowed("datenschutz", "ARZT")).toBe(true);
        } else {
            expect(routeChildPathAllowed("datenschutz", "ARZT")).toBe(false);
        }
    });
    it("catalog menu routes respect catalog-menu-flags", () => {
        if (REZEPTE_ATTESTE_MENU_ENABLED) {
            expect(routeChildPathAllowed("rezepte", "ARZT")).toBe(true);
            expect(routeChildPathAllowed("verwaltung/vorlagen", "ARZT")).toBe(true);
        } else {
            expect(routeChildPathAllowed("rezepte", "ARZT")).toBe(false);
            expect(routeChildPathAllowed("verwaltung/vorlagen", "ARZT")).toBe(false);
        }
        if (LEISTUNGEN_MENU_ENABLED) {
            expect(routeChildPathAllowed("leistungen", "ARZT")).toBe(true);
        } else {
            expect(routeChildPathAllowed("leistungen", "ARZT")).toBe(false);
        }
        if (PRODUKTE_MENU_ENABLED) {
            expect(routeChildPathAllowed("produkte", "ARZT")).toBe(true);
        } else {
            expect(routeChildPathAllowed("produkte", "ARZT")).toBe(false);
        }
    });
    it("GAP-01: REZEPTION cannot read medical records action", () => {
        expect(allowed("patient.read_medical", "REZEPTION")).toBe(false);
        expect(allowed("patient.behandlungen_list_for_zahlung", "REZEPTION")).toBe(true);
    });
});

describe("resolveRoutePathFromLocation", () => {
    it("maps dynamic patient paths to ROUTE_VISIBILITY keys", () => {
        expect(resolveRoutePathFromLocation("/patienten/p-42")).toBe("patienten/:id");
        expect(resolveRoutePathFromLocation("/patienten/p-42/rezept/neu")).toBe("patienten/:id/rezept/neu");
    });

    it("routeLocationAllowed uses resolved keys", () => {
        expect(routeLocationAllowed("/patienten/p-1", "REZEPTION")).toBe(true);
        expect(routeLocationAllowed("/akten/zu-validieren", "REZEPTION")).toBe(false);
    });
});

describe("settingsSectionVisible", () => {
    it("hides admin-only Einstellungen panels for REZEPTION", () => {
        expect(settingsSectionVisible("migration", "REZEPTION")).toBe(false);
        expect(settingsSectionVisible("system", "REZEPTION")).toBe(false);
        expect(settingsSectionVisible("lizenz", "REZEPTION")).toBe(false);
        expect(settingsSectionVisible("integrationen", "REZEPTION")).toBe(false);
        expect(settingsSectionVisible("praxis", "REZEPTION")).toBe(false);
        expect(settingsSectionVisible("sicherheit", "REZEPTION")).toBe(false);
        expect(settingsSectionVisible("konto", "REZEPTION")).toBe(true);
        expect(settingsSectionVisible("darstellung", "REZEPTION")).toBe(true);
        expect(settingsSectionVisible("arbeitsablaeufe", "REZEPTION")).toBe(true);
        expect(settingsSectionVisible("ueber", "REZEPTION")).toBe(true);
    });

    it("benachrichtigungen settings respects BENACHRICHTIGUNGEN_SETTINGS_ENABLED", () => {
        if (BENACHRICHTIGUNGEN_SETTINGS_ENABLED) {
            expect(settingsSectionVisible("benachrichtigungen", "REZEPTION")).toBe(true);
            expect(settingsSectionVisible("benachrichtigungen", "ARZT")).toBe(true);
        } else {
            expect(settingsSectionVisible("benachrichtigungen", "REZEPTION")).toBe(false);
            expect(settingsSectionVisible("benachrichtigungen", "ARZT")).toBe(false);
        }
    });

    it("shows praxis and sicherheit for ARZT", () => {
        expect(settingsSectionVisible("praxis", "ARZT")).toBe(true);
        expect(settingsSectionVisible("sicherheit", "ARZT")).toBe(true);
        expect(settingsSectionVisible("lizenz", "ARZT")).toBe(true);
        if (INTEGRATIONEN_SETTINGS_ENABLED) {
            expect(settingsSectionVisible("integrationen", "ARZT")).toBe(true);
        } else {
            expect(settingsSectionVisible("integrationen", "ARZT")).toBe(false);
        }
        if (MIGRATION_SETTINGS_ENABLED) {
            expect(settingsSectionVisible("migration", "ARZT")).toBe(true);
        } else {
            expect(settingsSectionVisible("migration", "ARZT")).toBe(false);
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
        expect(navItemVisible("ARZT", item)).toBe(true);
        expect(navItemVisible("REZEPTION", item)).toBe(false);
    });
    it("Verwaltung nav uses verwaltung.read (not REZEPTION)", () => {
        const item = NAV_ITEM_DEFINITIONS.find((i) => i.to === "/verwaltung");
        expect(item).toBeDefined();
        expect(navItemVisible("REZEPTION", item!)).toBe(false);
        expect(navItemVisible("ARZT", item!)).toBe(true);
    });

    it("REZEPTION: Kasseneingänge statt Finanzen/Tagesabschluss", () => {
        expect(routeChildPathAllowed("finanzen", "REZEPTION")).toBe(false);
        expect(routeChildPathAllowed("finanzen/kasse", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("finanzen/kasse/neu", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/finanzen-berichte/tagesabschluss", "REZEPTION")).toBe(false);
        expect(navItemVisible("REZEPTION", NAV_ITEM_DEFINITIONS.find((i) => i.to === "/finanzen/kasse")!)).toBe(true);
        expect(navItemVisible("REZEPTION", NAV_ITEM_DEFINITIONS.find((i) => i.to === "/finanzen")!)).toBe(false);
    });

    it("N6: REZEPTION has no Verwaltung routes", () => {
        expect(routeChildPathAllowed("verwaltung/praxisplanung", "REZEPTION")).toBe(false);
        expect(routeChildPathAllowed("verwaltung/arbeitszeiten", "REZEPTION")).toBe(false);
        expect(routeChildPathAllowed("verwaltung/team", "REZEPTION")).toBe(false);
        expect(routeChildPathAllowed("verwaltung/team/arbeitszeit", "REZEPTION")).toBe(false);
        expect(routeChildPathAllowed("personal", "REZEPTION")).toBe(false);
        expect(routeChildPathAllowed("verwaltung/behandlungs-katalog", "REZEPTION")).toBe(false);
        expect(routeChildPathAllowed("verwaltung/finanzen-berichte/tagesabschluss", "REZEPTION")).toBe(false);
    });
});
