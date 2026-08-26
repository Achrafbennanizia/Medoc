// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import { logWorkflowRouteEnter, tauriInvoke } from "./tauri.service";

function enableTauriRuntime(): void {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
        value: {},
        configurable: true,
        writable: true,
    });
}

describe("tauri workflow telemetry bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        enableTauriRuntime();
    });

    it("expands invoke args and logs start/success lifecycle", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined) // primary_action event
            .mockResolvedValueOnce("ok") // command invoke
            .mockResolvedValueOnce(undefined); // success event

        const result = await tauriInvoke<string>("sync_run_now", { patient_id: "p-1" });

        expect(result).toBe("ok");
        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ipc",
                    step: "sync_run_now",
                    stage: "primary_action",
                    action: "sync_run_now",
                    status: "started",
                }),
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            2,
            "sync_run_now",
            expect.objectContaining({
                patient_id: "p-1",
                patientId: "p-1",
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ipc",
                    step: "sync_run_now",
                    stage: "success",
                    action: "sync_run_now",
                    status: "ok",
                }),
            }),
        );
    });

    it("logs error lifecycle and rethrows command errors", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined) // primary_action event
            .mockRejectedValueOnce(new Error("boom")) // command invoke
            .mockResolvedValueOnce(undefined); // error event

        await expect(tauriInvoke("sync_run_now", { patientId: "p-1" })).rejects.toThrow("boom");
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "ipc",
                    step: "sync_run_now",
                    stage: "error",
                    action: "sync_run_now",
                    status: "Error",
                }),
            }),
        );
    });

    it("emits explicit route-enter events", () => {
        invokeMock.mockResolvedValue(undefined);
        logWorkflowRouteEnter("/login");
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "navigation",
                    step: "route-enter",
                    stage: "route_enter",
                    route: "/login",
                }),
            }),
        );
    });

    it("bridges browser workflow events (e.g. dialog cancel)", () => {
        invokeMock.mockResolvedValue(undefined);
        window.dispatchEvent(
            new CustomEvent("medoc:workflow-step", {
                detail: {
                    workflow: "dialog",
                    step: "dialog-escape",
                    stage: "cancel",
                    route: "/ops",
                },
            }),
        );
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    workflow: "dialog",
                    step: "dialog-escape",
                    stage: "cancel",
                    route: "/ops",
                }),
            }),
        );
    });
});
