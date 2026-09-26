import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

import { logWorkflowCancel, logWorkflowRouteEnter, tauriInvoke } from "./tauri.service";

function workflowEvents() {
    return invokeMock.mock.calls
        .filter(([cmd]) => cmd === "record_workflow_event")
        .map(([, payload]) => (payload as { event: Record<string, unknown> }).event);
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

describe("tauriInvoke workflow telemetry", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("emits primary-action and success workflow steps", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "record_workflow_event") return undefined;
            return { ok: true };
        });

        await tauriInvoke("list_patients", { patient_id: "seed-pat-001", pageSize: 20 });
        await flushMicrotasks();

        const events = workflowEvents();
        expect(events.map((event) => event.step)).toEqual(
            expect.arrayContaining(["primary_action", "success"]),
        );
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    step: "primary_action",
                    action: "list_patients",
                    metadata: expect.objectContaining({
                        argKeys: expect.arrayContaining([
                            "pageSize",
                            "page_size",
                            "patient_id",
                            "patientId",
                        ]),
                    }),
                }),
            ]),
        );
        expect(invokeMock).toHaveBeenCalledWith(
            "list_patients",
            expect.objectContaining({
                patient_id: "seed-pat-001",
                patientId: "seed-pat-001",
                pageSize: 20,
                page_size: 20,
            }),
        );
    });

    it("emits an error workflow step when a command fails", async () => {
        invokeMock.mockImplementation(async (cmd: string) => {
            if (cmd === "record_workflow_event") return undefined;
            throw new Error("backend boom");
        });

        await expect(
            tauriInvoke("create_patient", { name: "Alice", password: "hunter2" }),
        ).rejects.toThrow("backend boom");
        await flushMicrotasks();

        expect(workflowEvents()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ step: "primary_action", action: "create_patient" }),
                expect.objectContaining({
                    step: "error",
                    action: "create_patient",
                    message: "backend boom",
                }),
            ]),
        );
    });

    it("does not recursively self-log the workflow bridge command", async () => {
        invokeMock.mockResolvedValue(undefined);

        await tauriInvoke("record_workflow_event", {
            event: { step: "success", action: "noop" },
        });
        await flushMicrotasks();

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith(
            "record_workflow_event",
            expect.objectContaining({
                event: { step: "success", action: "noop" },
            }),
        );
    });

    it("exposes route-enter and cancel workflow helpers", async () => {
        invokeMock.mockResolvedValue(undefined);

        logWorkflowRouteEnter("/patients");
        logWorkflowCancel("dialog.escape", "Close patient dialog");
        await flushMicrotasks();

        expect(workflowEvents()).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    step: "route_enter",
                    action: "route.enter",
                    route: "/patients",
                }),
                expect.objectContaining({
                    step: "cancel",
                    action: "dialog.escape",
                    message: "Close patient dialog",
                }),
            ]),
        );
    });
});
