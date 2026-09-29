import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../adapters/practice-transport", () => ({
    practiceSystem: {
        invoke: vi.fn(),
    },
}));

vi.mock("./sync.controller", () => ({
    syncGetStatus: vi.fn(),
}));

vi.mock("@/systems/lan/lib/lan-client-config", () => ({
    isLanClientActive: vi.fn(() => false),
    loadLanClientConfig: vi.fn(() => ({
        schemaVersion: 1,
        enabled: false,
        baseUrl: "",
        accessToken: "",
    })),
}));

import { isLanClientActive, loadLanClientConfig } from "@/systems/lan/lib/lan-client-config";
import { practiceSystem } from "../adapters/practice-transport";
import { DEFAULT_SYNC_DEPLOYMENT } from "../lib/deployment-config";
import { probeBackgroundServers } from "./connectivity.controller";
import { syncGetStatus } from "./sync.controller";

describe("probeBackgroundServers", () => {
    beforeEach(() => {
        vi.mocked(practiceSystem.invoke).mockReset();
        vi.mocked(syncGetStatus).mockReset();
        vi.mocked(isLanClientActive).mockReturnValue(false);
        vi.mocked(loadLanClientConfig).mockReturnValue({
            schemaVersion: 1,
            enabled: false,
            baseUrl: "",
            accessToken: "",
        });
        vi.unstubAllGlobals();
    });

    it("is online when IPC get_session succeeds", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce(null);
        vi.mocked(syncGetStatus).mockRejectedValueOnce(new Error("no sync"));
        await expect(probeBackgroundServers()).resolves.toBe(true);
        expect(practiceSystem.invoke).toHaveBeenCalledWith("get_session");
    });

    it("is offline when IPC get_session fails", async () => {
        vi.mocked(practiceSystem.invoke).mockRejectedValueOnce(new Error("backend down"));
        await expect(probeBackgroundServers()).resolves.toBe(false);
    });

    it("requires LAN /health when LAN client is active", async () => {
        vi.mocked(isLanClientActive).mockReturnValue(true);
        vi.mocked(loadLanClientConfig).mockReturnValue({
            schemaVersion: 1,
            enabled: true,
            baseUrl: "https://192.168.1.10:8787",
            accessToken: "tok",
        });
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce({ user_id: "u1" });
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url: string) => {
                if (String(url).endsWith("/health")) return { ok: true };
                return { ok: false };
            }),
        );
        vi.mocked(syncGetStatus).mockRejectedValueOnce(new Error("unmapped"));
        await expect(probeBackgroundServers()).resolves.toBe(true);
        expect(fetch).toHaveBeenCalled();
    });

    it("is offline when LAN health and ping fail", async () => {
        vi.mocked(isLanClientActive).mockReturnValue(true);
        vi.mocked(loadLanClientConfig).mockReturnValue({
            schemaVersion: 1,
            enabled: true,
            baseUrl: "https://192.168.1.10:8787",
            accessToken: "tok",
        });
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce({ user_id: "u1" });
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
        await expect(probeBackgroundServers()).resolves.toBe(false);
    });

    it("probes replica master URL", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce(null);
        vi.mocked(syncGetStatus).mockResolvedValueOnce({
            localDeviceId: "dev-1",
            deployment: {
                ...DEFAULT_SYNC_DEPLOYMENT,
                mode: "serverless_peer",
                role: "REPLICA",
                masterBaseUrl: "https://master.local:8787",
            },
            localSeq: 0,
            pendingOutbox: 0,
            peers: [],
            vectors: {},
        });
        vi.stubGlobal(
            "fetch",
            vi.fn(async (url: string) => ({ ok: String(url).includes("master.local") && String(url).endsWith("/health") })),
        );
        await expect(probeBackgroundServers()).resolves.toBe(true);
    });
});
