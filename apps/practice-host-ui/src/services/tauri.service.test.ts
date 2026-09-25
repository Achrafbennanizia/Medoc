import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { logWorkflowRouteEnter, tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("tauri workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        invokeMock.mockResolvedValue(undefined as never);
    });

    it("logs primary action and success for regular commands", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined as never)
            .mockResolvedValueOnce({ ok: true } as never)
            .mockResolvedValueOnce(undefined as never);

        const result = await tauriInvoke<{ ok: boolean }>("list_patients", {
            patient_id: "p-1",
        });

        expect(result).toEqual({ ok: true });
        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_workflow_event",
            expect.objectContaining({
                step: "list_patients",
                phase: "primary_action",
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            2,
            "list_patients",
            expect.objectContaining({
                patient_id: "p-1",
                patientId: "p-1",
            }),
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                step: "list_patients",
                phase: "success",
                outcome: "ok",
            }),
        );
    });

    it("classifies cancel-like failures as cancel workflow events", async () => {
        const cancelled = new Error("dialog cancelled by user");
        invokeMock
            .mockResolvedValueOnce(undefined as never)
            .mockRejectedValueOnce(cancelled)
            .mockResolvedValueOnce(undefined as never);

        await expect(tauriInvoke("pick_backup_file")).rejects.toThrow("dialog cancelled by user");

        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                step: "pick_backup_file",
                phase: "cancel",
                outcome: "cancelled",
            }),
        );
    });

    it("does not recursively wrap the workflow command itself", async () => {
        await tauriInvoke("log_workflow_event", {
            route: "/patients/abc123def456",
            step: "route",
            phase: "route_enter",
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                route: "/patients/abc123def456",
                step: "route",
                phase: "route_enter",
            }),
        );
    });

    it("redacts route identifiers before route-enter logging", async () => {
        await logWorkflowRouteEnter("/patients/1234567890abcdef?name=alice");

        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                route: "/patients/:id",
                step: "route",
                phase: "route_enter",
            }),
        );
    });
});
