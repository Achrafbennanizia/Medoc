import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { logWorkflowRouteStep, tauriInvoke } from "./tauri.service";

const invokeMock = vi.mocked(invoke);

describe("tauri.service workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("emits workflow start/success around command invoke", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined) // workflow start
            .mockResolvedValueOnce({ ok: true }) // command
            .mockResolvedValueOnce(undefined); // workflow success

        const result = await tauriInvoke<{ ok: boolean }>("list_patients", {
            patient_id: "p-1",
        });

        expect(result).toEqual({ ok: true });
        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock).toHaveBeenNthCalledWith(
            1,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "primary_action",
                    status: "start",
                    command: "list_patients",
                    action: "list_patients",
                    argKeys: expect.arrayContaining(["patient_id", "patientId"]),
                }),
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
                event: expect.objectContaining({
                    step: "primary_action",
                    status: "success",
                    command: "list_patients",
                }),
            }),
        );
    });

    it("emits workflow error and rethrows command failures", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined) // workflow start
            .mockRejectedValueOnce(new Error("network down")) // command
            .mockResolvedValueOnce(undefined); // workflow error

        await expect(tauriInvoke("list_patients")).rejects.toThrow("network down");
        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "primary_action",
                    status: "error",
                    command: "list_patients",
                    detail: expect.stringContaining("network down"),
                }),
            }),
        );
    });

    it("does not recurse when sending workflow command itself", async () => {
        invokeMock.mockResolvedValueOnce("ok");
        const payload = { event: { step: "route_enter" } };
        const result = await tauriInvoke<string>("log_workflow_event", payload);
        expect(result).toBe("ok");
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", payload);
    });

    it("emits route workflow event for non-empty routes", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        await logWorkflowRouteStep("/patients?tab=open", "route_enter");
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    step: "route_enter",
                    status: "info",
                    route: "/patients?tab=open",
                    action: "route_navigation",
                }),
            }),
        );
    });

    it("skips route events for blank routes", async () => {
        await logWorkflowRouteStep("   ", "route_leave");
        expect(invokeMock).not.toHaveBeenCalled();
    });
});
