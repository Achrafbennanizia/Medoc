import { describe, expect, it } from "vitest";
import { EDITIONS } from "./edition";
import { FEATURE_MODULES, featureModuleOfRoute, routeEnabledInEdition } from "./feature-modules";
import { NAV_ITEM_DEFINITIONS, ROUTE_VISIBILITY, routeChildPathAllowed } from "./rbac";

describe("feature modules", () => {
    it("own only routes that exist, each route at most once", () => {
        const seen = new Set<string>();
        for (const m of FEATURE_MODULES) {
            for (const r of m.routes) {
                expect(r in ROUTE_VISIBILITY, `${m.id}: ${r}`).toBe(true);
                expect(seen.has(r), `${r} owned twice`).toBe(false);
                seen.add(r);
            }
        }
    });

    it("follow this build's capabilities (group in tests: everything on)", () => {
        for (const m of FEATURE_MODULES) expect(m.enabled).toBe(EDITIONS.group.caps[m.capability]);
        expect(routeEnabledInEdition("tickets")).toBe(true);
        expect(routeChildPathAllowed("tickets", "PHYSICIAN")).toBe(true);
    });

    it("are all off in Solo, which keeps the core routes", () => {
        for (const m of FEATURE_MODULES) expect(EDITIONS.solo.caps[m.capability], m.id).toBe(false);
        expect(featureModuleOfRoute("appointments")).toBeUndefined();
        expect(featureModuleOfRoute("staff/work-time")?.id).toBe("work-time");
    });

    it("cover every sidebar entry that belongs to a module", () => {
        const owned = NAV_ITEM_DEFINITIONS.filter((i) => featureModuleOfRoute(i.to.replace(/^\//, "")));
        expect(owned.map((i) => i.to).sort()).toEqual(expect.arrayContaining(["/charts/to-validate", "/staff/work-time", "/tickets"]));
    });
});
