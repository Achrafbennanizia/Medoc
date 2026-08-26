import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { logWorkflowUiStep, tauriInvoke } from "./tauri.service";

describe("tauri.service workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("emits workflow primary+success around command invoke", async () => {
        invokeMock.mockResolvedValue(undefined);

        await tauriInvoke("list_patienten", { patient_id: "p-1" });

        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_workflow_event",
            expect.objectContaining({
                payload: expect.objectContaining({
                    step: "primary_action",
                    action: "invoke",
                    command: "list_patienten",
                }),
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(2, "list_patienten", {
            patient_id: "p-1",
            patientId: "p-1",
        });
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                payload: expect.objectContaining({
                    step: "success",
                    status: "ok",
                    command: "list_patienten",
                }),
            }),
        );
    });

    it("marks picker-like null result as cancel", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined) // primary_action event
            .mockResolvedValueOnce(null) // picker command result
            .mockResolvedValueOnce(undefined); // cancel event

        const value = await tauriInvoke<string | null>("pick_backup_file");
        expect(value).toBeNull();

        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                payload: expect.objectContaining({
                    step: "cancel",
                    status: "cancelled",
                    command: "pick_backup_file",
                }),
            }),
        );
    });

    it("emits workflow error status on invoke failures", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined) // primary_action event
            .mockRejectedValueOnce(new Error("boom")) // failing command
            .mockResolvedValueOnce(undefined); // error event

        await expect(tauriInvoke("create_patient", { patient_id: "p-2" })).rejects.toThrow("boom");

        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                payload: expect.objectContaining({
                    step: "error",
                    status: "failed",
                    command: "create_patient",
                    detail: "Error",
                }),
            }),
        );
    });

    it("does not recursively instrument workflow log command", async () => {
        invokeMock.mockResolvedValue(undefined);

        await tauriInvoke("log_workflow_event", {
            payload: { step: "route_enter", route: "/login" },
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
            payload: { step: "route_enter", route: "/login" },
        });
    });

    it("allows route-level workflow logging calls", async () => {
        invokeMock.mockResolvedValue(undefined);
        logWorkflowUiStep("route_enter", { route: "/dashboard", action: "navigation" });
        await Promise.resolve();

        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                payload: expect.objectContaining({
                    step: "route_enter",
                    route: "/dashboard",
                    action: "navigation",
                }),
            }),
        );
    });
});
