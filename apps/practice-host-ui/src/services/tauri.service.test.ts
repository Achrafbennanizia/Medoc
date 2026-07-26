import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, workflowMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    workflowMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

vi.mock("@/systems/practice-host/lib/workflow-logger", () => ({
    logWorkflowEvent: workflowMock,
}));

import { tauriInvoke } from "./tauri.service";

describe("tauriInvoke workflow telemetry", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        workflowMock.mockReset();
    });

    it("mirrors snake/camel keys and logs action success lifecycle", async () => {
        invokeMock.mockResolvedValueOnce({ ok: true });

        await tauriInvoke("create_patient", {
            patient_id: "p-1",
            givenName: "Ada",
            optional: undefined,
        });

        expect(invokeMock).toHaveBeenCalledWith("create_patient", {
            patient_id: "p-1",
            patientId: "p-1",
            givenName: "Ada",
            given_name: "Ada",
        });
        expect(workflowMock).toHaveBeenNthCalledWith(1, {
            eventType: "primary_action",
            command: "create_patient",
        });
        expect(workflowMock).toHaveBeenNthCalledWith(2, {
            eventType: "success",
            command: "create_patient",
        });
    });

    it("logs cancel lifecycle for cancellation-like errors", async () => {
        invokeMock.mockRejectedValueOnce(new Error("Operation canceled by user"));

        await expect(tauriInvoke("open_native_print_dialog")).rejects.toThrow(
            "Operation canceled by user",
        );

        expect(workflowMock).toHaveBeenNthCalledWith(1, {
            eventType: "primary_action",
            command: "open_native_print_dialog",
        });
        expect(workflowMock).toHaveBeenNthCalledWith(2, {
            eventType: "cancel",
            command: "open_native_print_dialog",
            detail: "Operation canceled by user",
        });
    });

    it("skips recursive workflow logging for bridge command itself", async () => {
        invokeMock.mockResolvedValueOnce(undefined);

        await tauriInvoke("log_workflow_event", { eventType: "route_enter" });

        expect(workflowMock).not.toHaveBeenCalled();
    });

    it("logs error lifecycle for non-cancel failures", async () => {
        invokeMock.mockRejectedValueOnce(new Error("boom"));

        await expect(tauriInvoke("list_patienten")).rejects.toThrow("boom");

        expect(workflowMock).toHaveBeenNthCalledWith(1, {
            eventType: "primary_action",
            command: "list_patienten",
        });
        expect(workflowMock).toHaveBeenNthCalledWith(2, {
            eventType: "error",
            command: "list_patienten",
            detail: "boom",
        });
    });
});
