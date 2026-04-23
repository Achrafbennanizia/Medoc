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
    it("unknown action denied", () => {
        expect(allowed("evil.shell", "ARZT")).toBe(false);
    });
});

describe("routeChildPathAllowed", () => {
    it("allows patient detail when patienten list allowed", () => {
        expect(routeChildPathAllowed("patienten/:id", "REZEPTION")).toBe(true);
    });
    it("denies unknown route key", () => {
        expect(routeChildPathAllowed("unknown", "ARZT")).toBe(false);
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
