import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const srcRoot = resolve(import.meta.dirname, "..");

describe("three-system frontend layout", () => {
    it("has practice-host, lan, and company-portal modules", () => {
        for (const dir of ["practice-host", "lan", "company-portal"]) {
            expect(existsSync(resolve(srcRoot, "systems", dir))).toBe(true);
        }
    });

    it("keeps legacy controller re-exports", () => {
        expect(existsSync(resolve(srcRoot, "controllers", "patient.controller.ts"))).toBe(true);
        expect(existsSync(resolve(srcRoot, "controllers", "lan-server.controller.ts"))).toBe(true);
        expect(existsSync(resolve(srcRoot, "controllers", "company-portal.controller.ts"))).toBe(true);
    });

    it("exposes system registry", async () => {
        const { systems } = await import("@/systems/registry");
        expect(systems.practice).toBeDefined();
        expect(systems.lan).toBeDefined();
        expect(systems.company).toBeDefined();
    });

    it("has LAN pages module", () => {
        expect(existsSync(resolve(srcRoot, "systems/lan/pages/einstellungen-lan-host.tsx"))).toBe(
            true,
        );
    });

    it("has practice-host einstellungen sections", () => {
        expect(
            existsSync(
                resolve(srcRoot, "systems/practice-host/pages/einstellungen/einstellungen-praxis-section.tsx"),
            ),
        ).toBe(true);
    });

    it("has company-portal einstellungen section", () => {
        expect(
            existsSync(
                resolve(
                    srcRoot,
                    "systems/company-portal/pages/einstellungen-company-portal-section.tsx",
                ),
            ),
        ).toBe(true);
    });
});
