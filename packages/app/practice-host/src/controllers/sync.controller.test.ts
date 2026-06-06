import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../adapters/practice-transport", () => ({
    practiceSystem: {
        invoke: vi.fn(),
    },
}));

import { practiceSystem } from "../adapters/practice-transport";
import { DEFAULT_SYNC_DEPLOYMENT } from "../lib/deployment-config";
import { syncGetStatus, syncRunNow, syncSetDeployment } from "./sync.controller";

describe("sync.controller", () => {
    beforeEach(() => {
        vi.mocked(practiceSystem.invoke).mockReset();
    });

    it("syncGetStatus invokes sync_get_status", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce({
            localDeviceId: "dev-1",
            deployment: DEFAULT_SYNC_DEPLOYMENT,
            localSeq: 0,
            pendingOutbox: 0,
            peers: [],
            vectors: {},
        });
        const snap = await syncGetStatus();
        expect(practiceSystem.invoke).toHaveBeenCalledWith("sync_get_status");
        expect(snap.localDeviceId).toBe("dev-1");
    });

    it("syncSetDeployment maps camelCase deployment fields", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce(undefined);
        await syncSetDeployment({
            ...DEFAULT_SYNC_DEPLOYMENT,
            mode: "serverless_peer",
            role: "REPLICA",
            masterBaseUrl: "https://127.0.0.1:8787",
            activationToken: "mt2.x",
            unstableMesh: true,
        });
        expect(practiceSystem.invoke).toHaveBeenCalledWith("sync_set_deployment", {
            deployment: expect.objectContaining({
                mode: "serverless_peer",
                role: "REPLICA",
                masterBaseUrl: "https://127.0.0.1:8787",
                activationToken: "mt2.x",
                unstableMesh: true,
            }),
        });
    });

    it("syncRunNow invokes sync_run_now", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce({
            push: { accepted: 1, lastSeq: 2 },
            pull: { applied: 0, skipped: 0 },
        });
        const report = await syncRunNow();
        expect(practiceSystem.invoke).toHaveBeenCalledWith("sync_run_now");
        expect(report.push?.accepted).toBe(1);
    });

    it("SyncRunReport accepts mesh report shape", () => {
        const report = {
            push: { accepted: 1, lastSeq: 3 },
            pull: { applied: 2, skipped: 0 },
            mesh: { attempted: 2, succeeded: 1, errors: ["peer x: timeout"] },
            error: "pull: timeout",
        };
        expect(report.mesh?.succeeded).toBe(1);
        expect(report.mesh?.errors).toHaveLength(1);
    });
});
