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
        expect(routePathFromLocation("/patients")).toBe("patients");
        expect(routePathFromLocation("/charts/to-validate?x=1")).toBe("charts/to-validate");
    });

    it("maps nested patient routes to patients step", () => {
        const step = stepForRoute("PHYSICIAN", "patients/p-smoke-1");
        expect(step?.routePath).toBe("patients");
        expect(step?.titleKey).toBe("onboarding.physician.patients.title");
    });

    it("PHYSICIAN coverage reaches 100% when all routes done", () => {
        const steps = stepsForRole("PHYSICIAN");
        expect(steps.length).toBeGreaterThanOrEqual(8);
        const done = steps.map((s) => s.routePath);
        expect(coverageRatio("PHYSICIAN", done)).toBe(1);
        expect(meetsOnboardingCoverageTarget("PHYSICIAN", done)).toBe(true);
    });

    it("RECEPTION meets ≥80% target with ceil(required) routes", () => {
        const steps = stepsForRole("RECEPTION");
        expect(steps.length).toBeGreaterThanOrEqual(6);
        const required = routesRequiredForTarget("RECEPTION");
        expect(required / steps.length).toBeGreaterThanOrEqual(ONBOARDING_MIN_COVERAGE_RATIO);
        const partial = steps.slice(0, required).map((s) => s.routePath);
        expect(meetsOnboardingCoverageTarget("RECEPTION", partial)).toBe(true);
        expect(coverageRatio("RECEPTION", [])).toBe(0);
    });

    it("each role with steps defines unique route keys", () => {
        for (const role of ["PHYSICIAN", "RECEPTION"] as const) {
            const steps = stepsForRole(role);
            const paths = steps.map((s) => s.routePath);
            expect(new Set(paths).size).toBe(paths.length);
        }
        // TODO(deferred-roles): TAX_ADVISOR / PHARMA_CONSULTANT onboarding steps
        expect(stepsForRole("TAX_ADVISOR")).toEqual([]);
        expect(stepsForRole("PHARMA_CONSULTANT")).toEqual([]);
    });
});
