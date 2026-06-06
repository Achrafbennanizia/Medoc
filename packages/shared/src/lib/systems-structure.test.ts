import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { appRoot } from "./test-app-root";

describe("three-system frontend layout", () => {
    it("has tiered package directories (app / server / shared)", () => {
        for (const dir of [
            "packages/app/practice-host/src",
            "packages/server/lan/src",
            "packages/server/company/src",
            "packages/shared/src/lib",
            "packages/ui/src",
        ]) {
            expect(existsSync(resolve(appRoot, dir))).toBe(true);
        }
    });

    it("keeps Tauri adapters in the app shell (not in server packages)", () => {
        expect(
            existsSync(
                resolve(appRoot, "apps/practice-host-ui/src/systems/lan/adapters/tauri-lan.adapter.ts"),
            ),
        ).toBe(true);
        expect(
            existsSync(
                resolve(
                    appRoot,
                    "apps/practice-host-ui/src/systems/company-portal/adapters/tauri-company.adapter.ts",
                ),
            ),
        ).toBe(true);
        expect(existsSync(resolve(appRoot, "packages/server/lan/src/adapters"))).toBe(false);
    });

    it("has no legacy controller re-exports (single source under packages/*)", () => {
        expect(existsSync(resolve(appRoot, "apps/practice-host-ui/src/controllers"))).toBe(false);
    });

    it("has system-prefixed controllers in the expected packages", () => {
        expect(
            existsSync(
                resolve(appRoot, "packages/app/practice-host/src/controllers/patient.controller.ts"),
            ),
        ).toBe(true);
        expect(
            existsSync(
                resolve(appRoot, "packages/server/lan/src/controllers/lan-server.controller.ts"),
            ),
        ).toBe(true);
        expect(
            existsSync(
                resolve(
                    appRoot,
                    "packages/server/company/src/controllers/company-portal.controller.ts",
                ),
            ),
        ).toBe(true);
    });

    it("exposes system registry", async () => {
        const { systems } = await import(
            "../../../../apps/practice-host-ui/src/systems/registry"
        );
        expect(systems.practice).toBeDefined();
        expect(systems.lan).toBeDefined();
        expect(systems.company).toBeDefined();
    });

    it("has LAN pages module", () => {
        expect(
            existsSync(resolve(appRoot, "packages/server/lan/src/pages/einstellungen-lan-host.tsx")),
        ).toBe(true);
    });

    it("has practice-host einstellungen sections", () => {
        expect(
            existsSync(
                resolve(
                    appRoot,
                    "packages/app/practice-host/src/pages/einstellungen/einstellungen-praxis-section.tsx",
                ),
            ),
        ).toBe(true);
    });

    it("has deployment + sync settings section", () => {
        expect(
            existsSync(
                resolve(
                    appRoot,
                    "packages/app/practice-host/src/pages/einstellungen/einstellungen-deployment-section.tsx",
                ),
            ),
        ).toBe(true);
        expect(
            existsSync(
                resolve(appRoot, "packages/app/practice-host/src/lib/deployment-config.ts"),
            ),
        ).toBe(true);
    });

    it("has company-portal einstellungen section", () => {
        expect(
            existsSync(
                resolve(
                    appRoot,
                    "packages/server/company/src/pages/einstellungen-company-portal-section.tsx",
                ),
            ),
        ).toBe(true);
    });
});
