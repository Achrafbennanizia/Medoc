import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitWorkflowError, emitWorkflowPrimaryAction, emitWorkflowSuccess } from "@/lib/workflow-logger";
import { tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

vi.mock("@/lib/workflow-logger", () => ({
    emitWorkflowPrimaryAction: vi.fn(),
    emitWorkflowSuccess: vi.fn(),
    emitWorkflowError: vi.fn(),
}));

describe("tauriInvoke", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
        vi.mocked(emitWorkflowPrimaryAction).mockReset();
        vi.mocked(emitWorkflowSuccess).mockReset();
        vi.mocked(emitWorkflowError).mockReset();
    });

    it("logs primary action and success around invoke", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({ ok: true } as never);
        const result = await tauriInvoke<{ ok: boolean }>("get_session");
        expect(result).toEqual({ ok: true });
        expect(invoke).toHaveBeenCalledWith("get_session", {});
        expect(emitWorkflowPrimaryAction).toHaveBeenCalledTimes(1);
        expect(emitWorkflowSuccess).toHaveBeenCalledTimes(1);
        const correlationId = vi.mocked(emitWorkflowPrimaryAction).mock.calls[0]?.[1];
        expect(emitWorkflowSuccess).toHaveBeenCalledWith("get_session", correlationId, expect.any(Number));
    });

    it("logs invoke failures", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("boom"));
        await expect(tauriInvoke("create_payment", { patient_id: "p1" })).rejects.toThrow("boom");
        expect(emitWorkflowPrimaryAction).toHaveBeenCalledTimes(1);
        expect(emitWorkflowError).toHaveBeenCalledTimes(1);
        const correlationId = vi.mocked(emitWorkflowPrimaryAction).mock.calls[0]?.[1];
        expect(emitWorkflowError).toHaveBeenCalledWith("create_payment", correlationId, expect.any(Number));
    });

    it("skips workflow recursion when command is the workflow logger itself", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined as never);
        await tauriInvoke("record_workflow_event", {
            event: { stage: "route_enter", route: "/dashboard" },
        });
        expect(invoke).toHaveBeenCalledWith(
            "record_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({ stage: "route_enter" }),
            }),
        );
        expect(emitWorkflowPrimaryAction).not.toHaveBeenCalled();
        expect(emitWorkflowSuccess).not.toHaveBeenCalled();
        expect(emitWorkflowError).not.toHaveBeenCalled();
    });
});
