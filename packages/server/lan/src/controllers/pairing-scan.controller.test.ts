import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
}));

import { tauriInvoke } from "@/services/tauri.service";
import {
    pairingCheckStatus,
    pairingPersistToken,
    pairingScanLan,
    pairingSubmitRequest,
} from "./pairing-scan.controller";

describe("pairing-scan.controller", () => {
    beforeEach(() => {
        vi.mocked(tauriInvoke).mockReset();
    });

    it("pairingScanLan invokes pairing_scan_lan with seconds", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce([]);
        await pairingScanLan(3);
        expect(tauriInvoke).toHaveBeenCalledWith("pairing_scan_lan", { payload: { seconds: 3 } });
    });

    it("pairingSubmitRequest forwards master URL and label", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce({
            requestId: "req-1",
            deviceId: "dev-a",
            slavePubkey: "pk",
            masterPubkey: "mpk",
            masterDeviceId: "master-1",
        });
        const result = await pairingSubmitRequest({
            masterBaseUrl: "https://192.168.1.10:8787",
            masterCertSha256: "abc123",
            slaveLabel: "Tablet",
        });
        expect(result.requestId).toBe("req-1");
        expect(tauriInvoke).toHaveBeenCalledWith("pairing_submit_request", {
            payload: {
                masterBaseUrl: "https://192.168.1.10:8787",
                masterCertSha256: "abc123",
                slaveLabel: "Tablet",
            },
        });
    });

    it("pairingSubmitRequest defaults empty cert sha256", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce({ requestId: "r" } as never);
        await pairingSubmitRequest({
            masterBaseUrl: "https://127.0.0.1:8787",
            slaveLabel: "Replica",
        });
        expect(tauriInvoke).toHaveBeenCalledWith(
            "pairing_submit_request",
            expect.objectContaining({
                payload: expect.objectContaining({ masterCertSha256: "" }),
            }),
        );
    });

    it("pairingCheckStatus polls request status", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce({ status: "PENDING" } as never);
        await pairingCheckStatus({ requestId: "req-1", masterBaseUrl: "https://127.0.0.1:8787" });
        expect(tauriInvoke).toHaveBeenCalledWith("pairing_check_status", {
            payload: { requestId: "req-1", masterBaseUrl: "https://127.0.0.1:8787" },
        });
    });

    it("pairingPersistToken stores activation token", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce(undefined);
        await pairingPersistToken("mt2.body.sig");
        expect(tauriInvoke).toHaveBeenCalledWith("pairing_persist_token", {
            payload: { activationToken: "mt2.body.sig" },
        });
    });
});
