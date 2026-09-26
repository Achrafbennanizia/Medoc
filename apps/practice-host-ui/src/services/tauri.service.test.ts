import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

import { logWorkflowRouteEnter, tauriInvoke } from "./tauri.service";

describe("tauri.service workflow telemetry bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        delete globalThis.__MEDOC_WORKFLOW_TELEMETRY__;
    });

    it("does not emit workflow telemetry when disabled", async () => {
        globalThis.__MEDOC_WORKFLOW_TELEMETRY__ = false;
        invokeMock.mockResolvedValueOnce({ ok: true });

        const result = await tauriInvoke<{ ok: boolean }>("list_patients", { patient_id: "pat-1" });

        expect(result).toEqual({ ok: true });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("list_patients", {
            patient_id: "pat-1",
            patientId: "pat-1",
        });
    });

    it("emits primary_action and success around invoke calls", async () => {
        globalThis.__MEDOC_WORKFLOW_TELEMETRY__ = true;
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "list_patients") return [{ id: "pat-1" }];
            return undefined;
        });

        const rows = await tauriInvoke<Array<{ id: string }>>("list_patients", { patient_id: "pat-1" });

        expect(rows).toEqual([{ id: "pat-1" }]);
        const workflowCalls = invokeMock.mock.calls.filter(([cmd]) => cmd === "log_workflow_event");
        expect(workflowCalls).toHaveLength(2);
        expect(workflowCalls[0]?.[1]).toMatchObject({
            event: { stage: "primary_action", step: "list_patients", action: "list_patients" },
        });
        expect(workflowCalls[1]?.[1]).toMatchObject({
            event: { stage: "success", step: "list_patients", action: "list_patients" },
        });
    });

    it("emits an error workflow event when invoke throws", async () => {
        globalThis.__MEDOC_WORKFLOW_TELEMETRY__ = true;
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") return undefined;
            throw new Error("invoke failed");
        });

        await expect(tauriInvoke("list_patients")).rejects.toThrow("invoke failed");
        const workflowCalls = invokeMock.mock.calls
            .filter(([cmd]) => cmd === "log_workflow_event")
            .map(([, payload]) => payload);
        expect(workflowCalls).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    event: expect.objectContaining({ stage: "primary_action", step: "list_patients" }),
                }),
                expect.objectContaining({
                    event: expect.objectContaining({
                        stage: "error",
                        step: "list_patients",
                        message: "invoke failed",
                    }),
                }),
            ]),
        );
    });

    it("publishes route_enter workflow events", async () => {
        globalThis.__MEDOC_WORKFLOW_TELEMETRY__ = true;
        invokeMock.mockResolvedValue(undefined);

        logWorkflowRouteEnter("/login");
        await Promise.resolve();

        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    stage: "route_enter",
                    route: "/login",
                }),
            }),
        );
    });

    it("does not recurse for workflow command invocations", async () => {
        globalThis.__MEDOC_WORKFLOW_TELEMETRY__ = true;
        invokeMock.mockResolvedValue(undefined);

        await tauriInvoke("log_workflow_event", {
            event: {
                stage: "route_enter",
                step: "route_enter",
                route: "/login",
            },
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({ event: expect.objectContaining({ route: "/login" }) }),
        );
    });
});
