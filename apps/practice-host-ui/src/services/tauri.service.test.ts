import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

describe("tauri workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        vi.resetModules();
    });

    it("emits primary-action and success workflow events around IPC calls", async () => {
        invokeMock.mockImplementation(async (cmd: string, args?: Record<string, unknown>) => {
            if (cmd === "log_frontend_workflow_event") {
                return undefined;
            }
            return { cmd, args };
        });
        const { tauriInvoke } = await import("./tauri.service");
        const result = await tauriInvoke<{ cmd: string; args: Record<string, unknown> }>(
            "create_patient",
            {
                patient_id: "p-1",
                firstName: "Ada",
                ignored: undefined,
            },
        );

        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_frontend_workflow_event",
            {
                event: expect.objectContaining({
                    stage: "primary_action",
                    workflow: "ipc",
                    action: "create_patient",
                }),
            },
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            2,
            "create_patient",
            {
                patient_id: "p-1",
                patientId: "p-1",
                firstName: "Ada",
                first_name: "Ada",
            },
        );
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_frontend_workflow_event",
            {
                event: expect.objectContaining({
                    stage: "success",
                    workflow: "ipc",
                    action: "create_patient",
                    outcome: "ok",
                }),
            },
        );
        expect(result.cmd).toBe("create_patient");
        expect(result.args.patientId).toBe("p-1");
    });

    it("emits error workflow events and rethrows invoke failures", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_frontend_workflow_event") {
                return undefined;
            }
            throw new Error("backend failed");
        });
        const { tauriInvoke } = await import("./tauri.service");

        await expect(tauriInvoke("list_patients")).rejects.toThrow("backend failed");
        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_frontend_workflow_event",
            {
                event: expect.objectContaining({
                    stage: "primary_action",
                    action: "list_patients",
                }),
            },
        );
        expect(invokeMock).toHaveBeenNthCalledWith(2, "list_patients", {});
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_frontend_workflow_event",
            {
                event: expect.objectContaining({
                    stage: "error",
                    action: "list_patients",
                    outcome: "error",
                }),
            },
        );
    });

    it("does not recursively instrument direct workflow IPC events", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        const { tauriInvoke } = await import("./tauri.service");

        await tauriInvoke("log_frontend_workflow_event", {
            event: {
                stage: "success",
                workflow: "route",
                route: "/login",
            },
        });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_frontend_workflow_event", {
            event: {
                stage: "success",
                workflow: "route",
                route: "/login",
            },
        });
    });
});
