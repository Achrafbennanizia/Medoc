import { describe, expect, it } from "vitest";
import { allowed, navItemVisible, NAV_ITEM_DEFINITIONS, parseRole, routeChildPathAllowed, ROUTE_VISIBILITY, type Role } from "./rbac";

const ROLES = ["ARZT", "REZEPTION", "STEUERBERATER", "PHARMABERATER"] as const satisfies readonly Role[];

const VERWALTUNG_ROUTE_KEYS = [
    "verwaltung",
    "verwaltung/team",
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
        "verwaltung/arbeitstage": true,
        "verwaltung/praxisplanung": true,
        "verwaltung/arbeitszeiten": true,
        "verwaltung/sonder-sperrzeiten": true,
        "verwaltung/praxis-praeferenzen": true,
        "verwaltung/vorlagen": true,
        "verwaltung/vorlagen/editor": true,
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
        verwaltung: true,
        "verwaltung/team": false,
        "verwaltung/arbeitstage": false,
        "verwaltung/praxisplanung": false,
        "verwaltung/arbeitszeiten": false,
        "verwaltung/sonder-sperrzeiten": false,
        "verwaltung/praxis-praeferenzen": false,
        "verwaltung/vorlagen": false,
        "verwaltung/vorlagen/editor": false,
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
    STEUERBERATER: {
        verwaltung: true,
        "verwaltung/team": false,
        "verwaltung/arbeitstage": false,
        "verwaltung/praxisplanung": false,
        "verwaltung/arbeitszeiten": false,
        "verwaltung/sonder-sperrzeiten": false,
        "verwaltung/praxis-praeferenzen": false,
        "verwaltung/vorlagen": false,
        "verwaltung/vorlagen/editor": false,
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
    PHARMABERATER: {
        verwaltung: true,
        "verwaltung/team": false,
        "verwaltung/arbeitstage": false,
        "verwaltung/praxisplanung": false,
        "verwaltung/arbeitszeiten": false,
        "verwaltung/sonder-sperrzeiten": false,
        "verwaltung/praxis-praeferenzen": false,
        "verwaltung/vorlagen": false,
        "verwaltung/vorlagen/editor": false,
        "verwaltung/behandlungs-katalog": false,
        "verwaltung/bestellstamm": true,
        "verwaltung/finanzen-werkzeuge": false,
        "verwaltung/tagesabschluss": false,
        "verwaltung/finanzen-berichte": false,
        "verwaltung/finanzen-berichte/tagesabschluss": false,
        "verwaltung/finanzen-berichte/rechnung": false,
        "verwaltung/lager-und-bestellwesen": true,
        "verwaltung/vertraege": true,
        "verwaltung/leistungen-kataloge-vorlagen": false,
    },
};

describe("parseRole", () => {
    it("accepts known roles", () => {
        expect(parseRole("ARZT")).toBe("ARZT");
        expect(parseRole("REZEPTION")).toBe("REZEPTION");
    });
    it("rejects unknown", () => {
        expect(parseRole("ADMIN")).toBeNull();
        expect(parseRole(undefined)).toBeNull();
    });
});

describe("allowed (mirror of Rust rbac::allowed)", () => {
    it("Rezeption cannot read medical or audit", () => {
        expect(allowed("patient.read_medical", "REZEPTION")).toBe(false);
        expect(allowed("audit.read", "REZEPTION")).toBe(false);
    });
    it("Steuerberater may finanzen but not clinical", () => {
        expect(allowed("finanzen.read", "STEUERBERATER")).toBe(true);
        expect(allowed("patient.read_medical", "STEUERBERATER")).toBe(false);
    });
    it("bestellung.write mirrors Rust (not Steuerberater; Pharmaberater may)", () => {
        expect(allowed("bestellung.read", "STEUERBERATER")).toBe(true);
        expect(allowed("bestellung.write", "STEUERBERATER")).toBe(false);
        expect(allowed("bestellung.write", "ARZT")).toBe(true);
        expect(allowed("bestellung.write", "PHARMABERATER")).toBe(true);
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
    it("verwaltung.lager.write excludes Steuerberater", () => {
        expect(allowed("verwaltung.lager.write", "STEUERBERATER")).toBe(false);
        expect(allowed("verwaltung.lager.write", "REZEPTION")).toBe(true);
    });
    it("verwaltung.vertraege.write excludes Steuerberater", () => {
        expect(allowed("verwaltung.vertraege.write", "STEUERBERATER")).toBe(false);
        expect(allowed("verwaltung.vertraege.read", "STEUERBERATER")).toBe(true);
    });
    it("finanzen.tagesabschluss.write matches finanzen.write roles", () => {
        expect(allowed("finanzen.tagesabschluss.write", "STEUERBERATER")).toBe(true);
        expect(allowed("finanzen.tagesabschluss.write", "PHARMABERATER")).toBe(false);
    });
    it("patient.behandlungen_list_for_zahlung matches billing roles (mirrors Rust)", () => {
        expect(allowed("patient.behandlungen_list_for_zahlung", "ARZT")).toBe(true);
        expect(allowed("patient.behandlungen_list_for_zahlung", "REZEPTION")).toBe(true);
        expect(allowed("patient.behandlungen_list_for_zahlung", "STEUERBERATER")).toBe(true);
        expect(allowed("patient.behandlungen_list_for_zahlung", "PHARMABERATER")).toBe(false);
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
    it("allows bestellungen with finanzen.read", () => {
        expect(routeChildPathAllowed("bestellungen", "STEUERBERATER")).toBe(true);
        expect(routeChildPathAllowed("bestellungen", "PHARMABERATER")).toBe(false);
    });
    it("allows bestellungen/neu only with finanzen.write", () => {
        expect(routeChildPathAllowed("bestellungen/neu", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("bestellungen/neu", "STEUERBERATER")).toBe(true);
        expect(routeChildPathAllowed("bestellungen/neu", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("bestellungen/neu", "PHARMABERATER")).toBe(false);
    });
    it("allows migration only for Arzt", () => {
        expect(routeChildPathAllowed("migration", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("migration", "REZEPTION")).toBe(false);
    });
    it("allows hilfe and feedback for all roles", () => {
        expect(routeChildPathAllowed("hilfe", "PHARMABERATER")).toBe(true);
        expect(routeChildPathAllowed("feedback", "REZEPTION")).toBe(true);
    });
    it("allows termine/neu for roles with termin.write", () => {
        expect(routeChildPathAllowed("termine/neu", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("termine/neu", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("termine/neu", "PHARMABERATER")).toBe(false);
    });
    it("allows bilanz/neu for Arzt and Steuerberater", () => {
        expect(routeChildPathAllowed("bilanz/neu", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("bilanz/neu", "STEUERBERATER")).toBe(true);
        expect(routeChildPathAllowed("bilanz/neu", "REZEPTION")).toBe(false);
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
    it("Verwaltung nav uses verwaltung.read (all four roles)", () => {
        const item = NAV_ITEM_DEFINITIONS.find((i) => i.to === "/verwaltung");
        expect(item).toBeDefined();
        for (const role of ROLES) {
            expect(navItemVisible(role, item!)).toBe(true);
        }
    });
});
