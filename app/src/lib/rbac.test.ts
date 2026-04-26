import { describe, expect, it } from "vitest";
import { allowed, navItemVisible, parseRole, routeChildPathAllowed } from "./rbac";

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
    it("unknown action denied", () => {
        expect(allowed("evil.shell", "ARZT")).toBe(false);
    });
    it("patient.behandlungen_list_for_zahlung matches billing roles (mirrors Rust)", () => {
        expect(allowed("patient.behandlungen_list_for_zahlung", "ARZT")).toBe(true);
        expect(allowed("patient.behandlungen_list_for_zahlung", "REZEPTION")).toBe(true);
        expect(allowed("patient.behandlungen_list_for_zahlung", "STEUERBERATER")).toBe(true);
        expect(allowed("patient.behandlungen_list_for_zahlung", "PHARMABERATER")).toBe(false);
    });
});

describe("routeChildPathAllowed", () => {
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
    it("allows verwaltung hub with personal.read", () => {
        expect(routeChildPathAllowed("verwaltung", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung", "STEUERBERATER")).toBe(false);
    });
    it("allows bilanz/neu for Arzt and Steuerberater", () => {
        expect(routeChildPathAllowed("bilanz/neu", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("bilanz/neu", "STEUERBERATER")).toBe(true);
        expect(routeChildPathAllowed("bilanz/neu", "REZEPTION")).toBe(false);
    });
    it("allows verwaltung sub-routes with personal.read", () => {
        expect(routeChildPathAllowed("verwaltung/arbeitstage", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/vorlagen", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/vorlagen/editor", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/finanzen-werkzeuge", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/tagesabschluss", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/finanzen-berichte/tagesabschluss", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/finanzen-berichte/rechnung", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/finanzen-berichte", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/lager-und-bestellwesen", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/vertraege", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/leistungen-kataloge-vorlagen", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/vorlagen", "STEUERBERATER")).toBe(false);
    });
    it("allows verwaltung/bestellstamm with bestellung.read (not finanzen; Pharmaberater may open)", () => {
        expect(routeChildPathAllowed("verwaltung/bestellstamm", "ARZT")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/bestellstamm", "REZEPTION")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/bestellstamm", "STEUERBERATER")).toBe(true);
        expect(routeChildPathAllowed("verwaltung/bestellstamm", "PHARMABERATER")).toBe(true);
    });
});

describe("navItemVisible", () => {
    it("uses anyOf for compliance", () => {
        const item = {
            to: "/compliance",
            labelKey: "nav.compliance",
            icon: "x",
            visibility: { kind: "anyOf" as const, actions: ["ops.dsgvo", "ops.system"] },
        };
        expect(navItemVisible("ARZT", item)).toBe(true);
        expect(navItemVisible("REZEPTION", item)).toBe(false);
    });
});
