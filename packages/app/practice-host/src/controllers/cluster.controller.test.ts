import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/tauri.service", () => ({
    tauriInvoke: vi.fn(),
}));

import { tauriInvoke } from "@/services/tauri.service";
import {
    clusterSendJoinRequest,
    clusterSubmitSas,
    pairingHandleFromJoinPayload,
} from "./cluster.controller";

describe("pairingHandleFromJoinPayload", () => {
    it("reads nested handle.sessionId from the Rust join result", () => {
        expect(
            pairingHandleFromJoinPayload({
                handle: { sessionId: "sess-1", fingerprint: "fp-1" },
                handshakeTranscriptB64: "abc",
            }),
        ).toEqual({ sessionId: "sess-1", fingerprint: "fp-1" });
    });

    it("reads a flattened sessionId", () => {
        expect(
            pairingHandleFromJoinPayload({ sessionId: "sess-2", fingerprint: "fp-2" }),
        ).toEqual({ sessionId: "sess-2", fingerprint: "fp-2" });
    });

    it("throws when sessionId is missing", () => {
        expect(() => pairingHandleFromJoinPayload({ fingerprint: "fp" })).toThrow(/sessionId/);
    });
});

describe("cluster join IPC", () => {
    beforeEach(() => {
        vi.mocked(tauriInvoke).mockReset();
    });

    it("clusterSendJoinRequest flattens nested handle for the SAS step", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce({
            handle: { sessionId: "sess-9", fingerprint: "fp-9" },
            handshakeTranscriptB64: "dHJhbnNjcmlwdA==",
        });
        const result = await clusterSendJoinRequest("MEMBER", { host: "192.168.1.10", port: 49300 });
        expect(result).toEqual({
            sessionId: "sess-9",
            fingerprint: "fp-9",
            handshakeTranscriptB64: "dHJhbnNjcmlwdA==",
        });
    });

    it("clusterSubmitSas sends handle.sessionId on the payload", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce({ success: true, alreadyProvisioned: false });
        await clusterSubmitSas(
            { sessionId: "sess-9", fingerprint: "fp-9" },
            "1234",
            "dHJhbnNjcmlwdA==",
        );
        expect(tauriInvoke).toHaveBeenCalledWith("cluster_submit_sas", {
            payload: {
                handle: { sessionId: "sess-9", fingerprint: "fp-9" },
                digits: "1234",
                handshakeTranscriptB64: "dHJhbnNjcmlwdA==",
            },
        });
    });

    it("clusterSubmitSas unwraps a nested handle if the join result was stored whole", async () => {
        vi.mocked(tauriInvoke).mockResolvedValueOnce({ success: true, alreadyProvisioned: false });
        await clusterSubmitSas(
            {
                handle: { sessionId: "sess-nested", fingerprint: "fp-n" },
            } as never,
            "9999",
            "",
        );
        expect(tauriInvoke).toHaveBeenCalledWith("cluster_submit_sas", {
            payload: {
                handle: { sessionId: "sess-nested", fingerprint: "fp-n" },
                digits: "9999",
                handshakeTranscriptB64: "",
            },
        });
    });
});
