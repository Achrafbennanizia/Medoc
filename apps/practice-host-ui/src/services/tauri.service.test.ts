import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { logWorkflowEvent, tauriInvoke } from "./tauri.service";

async function flushAsyncEvents() {
    await Promise.resolve();
    await Promise.resolve();
}

describe("tauriInvoke workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("emits primary_action and success workflow phases", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") return;
            return { ok: true };
        });

        const result = await tauriInvoke<{ ok: boolean }>("list_patients");
        expect(result).toEqual({ ok: true });
        await flushAsyncEvents();

        const workflowPhases = invokeMock.mock.calls
            .filter(([cmd]) => cmd === "log_workflow_event")
            .map(([, payload]) => (payload as { event: { phase: string } }).event.phase);
        expect(workflowPhases).toContain("primary_action");
        expect(workflowPhases).toContain("success");
    });

    it("emits error workflow phase when invoke rejects", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") return;
            throw new Error("backend failed");
        });

        await expect(tauriInvoke("create_patient", { patient_id: "pat-1" })).rejects.toThrow("backend failed");
        await flushAsyncEvents();

        const errorEvent = invokeMock.mock.calls
            .filter(([cmd]) => cmd === "log_workflow_event")
            .map(([, payload]) => payload as { event: { phase: string; command: string } })
            .find((call) => call.event.phase === "error");
        expect(errorEvent?.event.command).toBe("create_patient");
    });

    it("never recursively instruments the workflow bridge command", async () => {
        invokeMock.mockResolvedValue(undefined);

        await tauriInvoke("log_workflow_event", {
            event: { phase: "route_enter", step: "route.enter", route: "/login" },
        });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({ phase: "route_enter", step: "route.enter" }),
            }),
        );
    });

    it("does not fail command execution when workflow logging fails", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") {
                throw new Error("workflow logger unavailable");
            }
            return 7;
        });

        await expect(tauriInvoke<number>("count_open_practice_tasks_for_me")).resolves.toBe(7);
    });

    it("supports explicit route-enter logging helper", async () => {
        invokeMock.mockResolvedValue(undefined);

        await logWorkflowEvent({
            phase: "route_enter",
            step: "route.enter",
            route: "/dashboard",
        });

        expect(invokeMock).toHaveBeenCalledWith(
            "log_workflow_event",
            expect.objectContaining({
                event: expect.objectContaining({
                    phase: "route_enter",
                    step: "route.enter",
                    route: "/dashboard",
                }),
            }),
        );
    });
});
