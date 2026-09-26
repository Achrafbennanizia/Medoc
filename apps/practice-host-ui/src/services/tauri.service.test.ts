import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { logWorkflowRouteEnter, normalizeWorkflowRoute, tauriInvoke } from "@/services/tauri.service";

describe("tauriInvoke workflow instrumentation", () => {
    const invokeMock = vi.mocked(invoke);

    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("expands dual-case args and emits success workflow events", async () => {
        invokeMock.mockResolvedValueOnce({ ok: true } as never);
        invokeMock.mockResolvedValueOnce(undefined as never);

        const result = await tauriInvoke<{ ok: boolean }>("create_patient", {
            patient_id: "p-1",
            doctorId: "u-1",
            ignored: undefined,
        });

        expect(result).toEqual({ ok: true });
        expect(invokeMock).toHaveBeenNthCalledWith(1, "create_patient", {
            patient_id: "p-1",
            patientId: "p-1",
            doctorId: "u-1",
            doctor_id: "u-1",
        });
        expect(invokeMock).toHaveBeenNthCalledWith(2, "log_workflow_event", {
            payload: expect.objectContaining({
                step: "primary_action",
                command: "create_patient",
                outcome: "success",
            }),
        });
    });

    it("rethrows command errors and emits error workflow events", async () => {
        invokeMock.mockRejectedValueOnce(new Error("boom"));
        invokeMock.mockResolvedValueOnce(undefined as never);

        await expect(tauriInvoke("delete_patient", { id: "p-1" })).rejects.toThrow("boom");
        expect(invokeMock).toHaveBeenNthCalledWith(2, "log_workflow_event", {
            payload: expect.objectContaining({
                step: "primary_action",
                command: "delete_patient",
                outcome: "error",
                detail: "Error",
            }),
        });
    });

    it("does not recurse when invoking the workflow command itself", async () => {
        invokeMock.mockResolvedValueOnce(undefined as never);

        await tauriInvoke("log_workflow_event", {
            payload: { step: "route_enter" },
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
            payload: { step: "route_enter" },
        });
    });
});

describe("workflow route normalization", () => {
    it("redacts dynamic route segments", () => {
        expect(normalizeWorkflowRoute("/patients/p-123")).toBe("/patients/:id");
        expect(normalizeWorkflowRoute("/patients/p-123/prescription/new")).toBe(
            "/patients/:id/prescription/new",
        );
        expect(normalizeWorkflowRoute("/patients/p-123/prescription/rx-5")).toBe(
            "/patients/:id/prescription/:prescriptionId",
        );
        expect(normalizeWorkflowRoute("/tickets/task-77/edit")).toBe("/tickets/:id/edit");
        expect(normalizeWorkflowRoute("/purchase-orders/po-9")).toBe("/purchase-orders/:id");
    });

    it("emits route-enter workflow events", async () => {
        const invokeMock = vi.mocked(invoke);
        invokeMock.mockResolvedValueOnce(undefined as never);

        await logWorkflowRouteEnter("/patients/p-123");

        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
            payload: expect.objectContaining({
                step: "route_enter",
                route: "/patients/:id",
                outcome: "enter",
            }),
        });
    });
});
