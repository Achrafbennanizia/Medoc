import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

vi.mock("../lib/workflow-logger", () => ({
    classifyWorkflowFailurePhase: vi.fn(() => "error"),
    currentWorkflowRoute: vi.fn(() => "/patients"),
    formatWorkflowFailure: vi.fn((error: unknown) =>
        error instanceof Error ? error.message : String(error),
    ),
    logWorkflowEventFireAndForget: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
    classifyWorkflowFailurePhase,
    logWorkflowEventFireAndForget,
} from "../lib/workflow-logger";
import { tauriInvoke } from "./tauri.service";

describe("tauri.service workflow instrumentation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("logs primary action and success around invokes", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({ ok: true });
        await tauriInvoke("create_patient", { patient_id: "p-1" });

        expect(invoke).toHaveBeenCalledWith("create_patient", {
            patient_id: "p-1",
            patientId: "p-1",
        });
        expect(logWorkflowEventFireAndForget).toHaveBeenNthCalledWith(1, {
            phase: "primary_action",
            route: "/patients",
            action: "create_patient",
            detail: "args:patient_id,patientId",
        });
        expect(logWorkflowEventFireAndForget).toHaveBeenNthCalledWith(2, {
            phase: "success",
            route: "/patients",
            action: "create_patient",
            status: "ok",
        });
    });

    it("logs workflow cancel/error on invoke rejection", async () => {
        vi.mocked(classifyWorkflowFailurePhase).mockReturnValueOnce("cancel");
        vi.mocked(invoke).mockRejectedValueOnce(new Error("Request canceled"));

        await expect(tauriInvoke("update_patient", { patientId: "p-2" })).rejects.toThrow(
            "Request canceled",
        );

        expect(logWorkflowEventFireAndForget).toHaveBeenNthCalledWith(1, {
            phase: "primary_action",
            route: "/patients",
            action: "update_patient",
            detail: "args:patientId,patient_id",
        });
        expect(logWorkflowEventFireAndForget).toHaveBeenNthCalledWith(2, {
            phase: "cancel",
            route: "/patients",
            action: "update_patient",
            status: "canceled",
            detail: "Request canceled",
        });
    });

    it("does not recursively instrument workflow bridge command itself", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);
        await tauriInvoke("log_workflow_event", { phase: "route_enter" });
        expect(logWorkflowEventFireAndForget).not.toHaveBeenCalled();
    });
});
