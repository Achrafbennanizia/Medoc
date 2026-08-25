import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { tauriInvoke } from "@/services/tauri.service";
import { logWorkflowOutcome, logWorkflowPrimaryAction } from "@/services/workflow.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

vi.mock("@/services/workflow.service", () => ({
    logWorkflowPrimaryAction: vi.fn(),
    logWorkflowOutcome: vi.fn(),
}));

describe("tauriInvoke workflow logging", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("logs primary action and success for successful invoke", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({ ok: true });
        const result = await tauriInvoke<{ ok: boolean }>("list_patienten");
        expect(result).toEqual({ ok: true });
        expect(invoke).toHaveBeenCalledWith("list_patienten", {});
        expect(logWorkflowPrimaryAction).toHaveBeenCalledWith("list_patienten");
        expect(logWorkflowOutcome).toHaveBeenCalledWith("success", "list_patienten");
    });

    it("logs cancel outcome when invoke rejects with cancel-like error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Operation cancelled by user"));
        await expect(tauriInvoke("pairing_submit_request", { host: "127.0.0.1" })).rejects.toThrow(
            "Operation cancelled by user",
        );
        expect(logWorkflowPrimaryAction).toHaveBeenCalledWith("pairing_submit_request");
        expect(logWorkflowOutcome).toHaveBeenCalledWith(
            "cancel",
            "pairing_submit_request",
            "Operation cancelled by user",
        );
    });
});
