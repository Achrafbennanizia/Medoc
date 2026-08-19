import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../adapters/practice-transport", () => ({
    practiceSystem: {
        invoke: vi.fn(),
    },
}));

import { practiceSystem } from "../adapters/practice-transport";
import {
    DEFAULT_ALLOWED_ACTIONS,
    OPTIONAL_READ_ACTIONS,
    pairingDecide,
    pairingListAll,
    pairingListPending,
    pairingMasterInfo,
    pairingRevoke,
    type PairingRequest,
} from "./pairing.controller";

describe("pairing.controller", () => {
    beforeEach(() => {
        vi.mocked(practiceSystem.invoke).mockReset();
    });

    it("DEFAULT_ALLOWED_ACTIONS includes sync and pairing peers", () => {
        expect(DEFAULT_ALLOWED_ACTIONS).toContain("sync.push");
        expect(DEFAULT_ALLOWED_ACTIONS).toContain("pairing.peers");
    });

    it("OPTIONAL_READ_ACTIONS lists patient and appointment read scopes", () => {
        expect(OPTIONAL_READ_ACTIONS).toEqual(["patient.read", "appointment.read"]);
    });

    it("pairingListPending invokes pairing_list_pending", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce([]);
        await pairingListPending();
        expect(practiceSystem.invoke).toHaveBeenCalledWith("pairing_list_pending");
    });

    it("pairingListAll invokes pairing_list_all", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce([]);
        await pairingListAll();
        expect(practiceSystem.invoke).toHaveBeenCalledWith("pairing_list_all");
    });

    it("pairingDecide forwards accept and allowed actions", async () => {
        const req: PairingRequest = {
            id: "req-1",
            deviceId: "dev-a",
            slavePubkey: "pk",
            slaveLabel: "Tablet",
            requesterIp: "127.0.0.1",
            status: "PENDING",
            allowedActions: [...DEFAULT_ALLOWED_ACTIONS, ...OPTIONAL_READ_ACTIONS],
            activationToken: null,
            requestedAt: "2026-06-02T12:00:00Z",
            decidedAt: "2026-06-02T12:01:00Z",
            decidedBy: "seed-physician-001",
            awaitingPin: true,
        };
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce({
            request: req,
            confirmPin: "4829",
        });
        const result = await pairingDecide("req-1", true, [
            ...DEFAULT_ALLOWED_ACTIONS,
            "patient.read",
        ]);
        expect(result.confirmPin).toBe("4829");
        expect(result.request.awaitingPin).toBe(true);
        expect(practiceSystem.invoke).toHaveBeenCalledWith("pairing_decide", {
            payload: {
                requestId: "req-1",
                accept: true,
                allowedActions: [...DEFAULT_ALLOWED_ACTIONS, "patient.read"],
            },
        });
    });

    it("pairingRevoke invokes pairing_revoke", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce(undefined);
        await pairingRevoke("dev-a");
        expect(practiceSystem.invoke).toHaveBeenCalledWith("pairing_revoke", { deviceId: "dev-a" });
    });

    it("pairingMasterInfo invokes pairing_master_info", async () => {
        vi.mocked(practiceSystem.invoke).mockResolvedValueOnce({
            masterDeviceId: "master-1",
            masterPubkey: "pubkey-b64",
        });
        const info = await pairingMasterInfo();
        expect(info.masterDeviceId).toBe("master-1");
    });
});
