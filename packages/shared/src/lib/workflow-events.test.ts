import { describe, expect, it } from "vitest";
import { sanitizeWorkflowRoute } from "./workflow-events";

describe("sanitizeWorkflowRoute", () => {
    it("redacts numeric and uuid path segments", () => {
        const route = sanitizeWorkflowRoute(
            "/patienten/12345/rezept/550e8400-e29b-41d4-a716-446655440000"
        );
        expect(route).toBe("/patienten/:id/rezept/:id");
    });

    it("keeps static route segments unchanged", () => {
        expect(sanitizeWorkflowRoute("/verwaltung/sonder-sperrzeiten")).toBe(
            "/verwaltung/sonder-sperrzeiten"
        );
    });
});
