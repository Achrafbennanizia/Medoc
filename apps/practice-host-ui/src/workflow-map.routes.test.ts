import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function routePathsFromAppSource(source: string): string[] {
    return [...source.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
}

describe("workflow route map inventory", () => {
    it("keeps the critical workflow routes declared in App.tsx", () => {
        const appSource = readFileSync(path.resolve(__dirname, "./App.tsx"), "utf-8");
        const routes = routePathsFromAppSource(appSource);

        expect(routes.length).toBeGreaterThanOrEqual(45);
        expect(routes).toEqual(
            expect.arrayContaining([
                "/onboarding",
                "/onboarding/lizenz",
                "/onboarding/beitreten",
                "/login",
                "/",
                "termine",
                "patienten",
                "patienten/:id",
                "tickets",
                "finanzen",
                "einstellungen",
                "migration",
                "ops",
            ]),
        );
    });
});
