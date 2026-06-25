import { beforeEach, describe, expect, it, vi } from "vitest";

import { invoke } from "@tauri-apps/api/core";
import { tauriInvoke } from "@/services/tauri.service";
import { classifyWorkflowError, recordWorkflowEvent, workflowErrorDetail } from "@/services/workflow-logger";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

vi.mock("@/services/workflow-logger", () => ({
    recordWorkflowEvent: vi.fn().mockResolvedValue(undefined),
    classifyWorkflowError: vi.fn().mockReturnValue("error"),
    workflowErrorDetail: vi.fn().mockReturnValue("invoke_error"),
}));

describe("tauriInvoke workflow bridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("records primary action + success around invoke", async () => {
        vi.mocked(invoke).mockResolvedValueOnce("ok");

        const out = await tauriInvoke<string>("list_patienten", { patient_id: "p-1" });

        expect(out).toBe("ok");
        expect(recordWorkflowEvent).toHaveBeenNthCalledWith(1, {
            step: "primary_action",
            action: "list_patienten",
        });
        expect(recordWorkflowEvent).toHaveBeenNthCalledWith(2, {
            step: "success",
            action: "list_patienten",
        });
        expect(invoke).toHaveBeenCalledWith(
            "list_patienten",
            expect.objectContaining({ patient_id: "p-1", patientId: "p-1" }),
        );
    });

    it("records error outcome and rethrows", async () => {
        const err = new Error("boom");
        vi.mocked(invoke).mockRejectedValueOnce(err);
        vi.mocked(classifyWorkflowError).mockReturnValueOnce("error");
        vi.mocked(workflowErrorDetail).mockReturnValueOnce("Error");

        await expect(tauriInvoke("create_patient", { name: "Alice" })).rejects.toThrow("boom");

        expect(recordWorkflowEvent).toHaveBeenNthCalledWith(1, {
            step: "primary_action",
            action: "create_patient",
        });
        expect(recordWorkflowEvent).toHaveBeenNthCalledWith(2, {
            step: "error",
            action: "create_patient",
            detail: "Error",
        });
    });

    it("bypasses workflow bridge for workflow logging command", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await tauriInvoke("log_workflow_event", {
            event: { step: "route_enter", route: "/login" },
        });

        expect(recordWorkflowEvent).not.toHaveBeenCalled();
        expect(invoke).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({ event: expect.any(Object) }),
        );
    });
});
