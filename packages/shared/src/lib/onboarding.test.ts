import { describe, expect, it } from "vitest";
import {
    ONBOARDING_MIN_COVERAGE_RATIO,
    coverageRatio,
    meetsOnboardingCoverageTarget,
    routePathFromLocation,
    routesRequiredForTarget,
    stepForRoute,
    stepsForRole,
} from "./onboarding";

describe("onboarding (G6)", () => {
    it("normalizes route paths", () => {
        expect(routePathFromLocation("/")).toBe("");
        expect(routePathFromLocation("/patienten")).toBe("patienten");
        expect(routePathFromLocation("/akten/zu-validieren?x=1")).toBe("akten/zu-validieren");
    });

    it("maps nested patient routes to patienten step", () => {
        const step = stepForRoute("ARZT", "patienten/p-smoke-1");
        expect(step?.routePath).toBe("patienten");
        expect(step?.titleDe).toBe("Patienten");
    });

    it("ARZT coverage reaches 100% when all routes done", () => {
        const steps = stepsForRole("ARZT");
        expect(steps.length).toBeGreaterThanOrEqual(8);
        const done = steps.map((s) => s.routePath);
        expect(coverageRatio("ARZT", done)).toBe(1);
        expect(meetsOnboardingCoverageTarget("ARZT", done)).toBe(true);
    });

    it("REZEPTION meets ≥80% target with ceil(required) routes", () => {
        const steps = stepsForRole("REZEPTION");
        expect(steps.length).toBeGreaterThanOrEqual(6);
        const required = routesRequiredForTarget("REZEPTION");
        expect(required / steps.length).toBeGreaterThanOrEqual(ONBOARDING_MIN_COVERAGE_RATIO);
        const partial = steps.slice(0, required).map((s) => s.routePath);
        expect(meetsOnboardingCoverageTarget("REZEPTION", partial)).toBe(true);
        expect(coverageRatio("REZEPTION", [])).toBe(0);
    });

    it("each role with steps defines unique route keys", () => {
        for (const rolle of ["ARZT", "REZEPTION"] as const) {
            const steps = stepsForRole(rolle);
            const paths = steps.map((s) => s.routePath);
            expect(new Set(paths).size).toBe(paths.length);
        }
        // TODO(deferred-roles): STEUERBERATER / PHARMABERATER onboarding steps
        expect(stepsForRole("STEUERBERATER")).toEqual([]);
        expect(stepsForRole("PHARMABERATER")).toEqual([]);
    });
});
