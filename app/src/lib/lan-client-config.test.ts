import { describe, expect, it, beforeEach } from "vitest";
import {
    EMPTY_LAN_CLIENT_CONFIG,
    isLanClientActive,
    loadLanClientConfig,
    saveLanClientConfig,
} from "@/systems/lan/lib/lan-client-config";

describe("lan-client-config", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("defaults to disabled", () => {
        expect(loadLanClientConfig()).toEqual(EMPTY_LAN_CLIENT_CONFIG);
        expect(isLanClientActive()).toBe(false);
    });

    it("round-trips storage", () => {
        saveLanClientConfig({
            schemaVersion: 1,
            enabled: true,
            baseUrl: "https://10.0.0.5:8787",
            accessToken: "jwt-test",
        });
        const cfg = loadLanClientConfig();
        expect(cfg.enabled).toBe(true);
        expect(cfg.baseUrl).toBe("https://10.0.0.5:8787");
        expect(cfg.accessToken).toBe("jwt-test");
        expect(isLanClientActive(cfg)).toBe(true);
    });

    it("strips trailing slash from baseUrl", () => {
        saveLanClientConfig({
            schemaVersion: 1,
            enabled: true,
            baseUrl: "https://host:8787/",
            accessToken: "x",
        });
        expect(loadLanClientConfig().baseUrl).toBe("https://host:8787");
    });
});
