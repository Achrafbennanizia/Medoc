import { describe, expect, it } from "vitest";
import {
    DEFAULT_SYNC_DEPLOYMENT,
    isCoLocatedHost,
    isLanClientOnly,
    isServerlessPeer,
} from "@/systems/practice-host/lib/deployment-config";

describe("deployment-config", () => {
    it("defaults to practice desktop master", () => {
        expect(DEFAULT_SYNC_DEPLOYMENT.mode).toBe("practice_desktop");
        expect(DEFAULT_SYNC_DEPLOYMENT.role).toBe("MASTER");
    });

    it("classifies deployment modes", () => {
        expect(isCoLocatedHost("practice_desktop")).toBe(true);
        expect(isLanClientOnly("lan_client")).toBe(true);
        expect(isServerlessPeer("serverless_peer")).toBe(true);
        expect(isLanClientOnly("practice_desktop")).toBe(false);
    });
});
