import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriInvoke } from "@/services/tauri.service";

const { invokeMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

function workflowCalls() {
    return invokeMock.mock.calls.filter(([cmd]) => cmd === "log_workflow_event");
}

describe("tauriInvoke workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("logs primary+success workflow events and expands snake_case args", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined)
            .mockResolvedValueOnce({ ok: true })
            .mockResolvedValueOnce(undefined);

        const result = await tauriInvoke<{ ok: boolean }>("create_patient", {
            patient_id: "p-1",
            optionalField: undefined,
        });
        expect(result).toEqual({ ok: true });

        await Promise.resolve();
        await Promise.resolve();

        const commandCall = invokeMock.mock.calls.find(([cmd]) => cmd === "create_patient");
        expect(commandCall).toBeTruthy();
        expect(commandCall?.[1]).toMatchObject({
            patient_id: "p-1",
            patientId: "p-1",
        });
        expect(commandCall?.[1]).not.toHaveProperty("optionalField");

        const calls = workflowCalls();
        expect(calls).toHaveLength(2);
        const stages = calls.map(([, payload]) => (payload as { event: { stage: string } }).event.stage);
        expect(stages).toEqual(expect.arrayContaining(["primary_action", "success"]));
    });

    it("classifies abort-like failures as cancel workflow stage", async () => {
        invokeMock
            .mockResolvedValueOnce(undefined)
            .mockRejectedValueOnce(new Error("AbortError: request cancelled"))
            .mockResolvedValueOnce(undefined);

        await expect(tauriInvoke("sync_run_now")).rejects.toThrow("AbortError");

        await Promise.resolve();
        await Promise.resolve();

        const calls = workflowCalls();
        expect(calls).toHaveLength(2);
        const cancelCall = calls.find(
            ([, payload]) => (payload as { event: { stage: string } }).event.stage === "cancel",
        );
        expect(cancelCall).toBeTruthy();
        expect((cancelCall?.[1] as { event: { status: string } }).event.status).toBe("cancelled");
    });

    it("does not recursively log workflow command invocations", async () => {
        invokeMock.mockResolvedValueOnce(undefined);
        await tauriInvoke("log_workflow_event", {
            event: {
                workflow: "ui_navigation",
                stage: "route_enter",
            },
        });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
            event: {
                workflow: "ui_navigation",
                stage: "route_enter",
            },
        });
    });
});
