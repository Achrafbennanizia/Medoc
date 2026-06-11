import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock, emitWorkflowEventMock } = vi.hoisted(() => ({
    invokeMock: vi.fn(),
    emitWorkflowEventMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
    invoke: invokeMock,
}));

vi.mock("./workflow-log.service", () => ({
    WORKFLOW_LOG_COMMAND: "record_workflow_event",
    emitWorkflowEvent: emitWorkflowEventMock,
}));

import { tauriInvoke } from "./tauri.service";

describe("tauri.service", () => {
    beforeEach(() => {
        invokeMock.mockReset();
        emitWorkflowEventMock.mockReset();
        emitWorkflowEventMock.mockResolvedValue(undefined);
    });

    it("expands snake_case args and emits start/success workflow events", async () => {
        invokeMock.mockResolvedValue({ ok: true });
        const result = await tauriInvoke<{ ok: boolean }>("create_patient", {
            patient_id: "pat-1",
        });
        expect(result.ok).toBe(true);
        expect(invokeMock).toHaveBeenCalledWith("create_patient", {
            patient_id: "pat-1",
            patientId: "pat-1",
        });
        expect(emitWorkflowEventMock).toHaveBeenCalledTimes(2);
        expect(emitWorkflowEventMock).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                phase: "command",
                outcome: "start",
                command: "create_patient",
            }),
        );
        expect(emitWorkflowEventMock).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                phase: "command",
                outcome: "success",
                command: "create_patient",
            }),
        );
    });

    it("emits command error workflow event and rethrows invoke errors", async () => {
        invokeMock.mockRejectedValue(new Error("broken"));
        await expect(tauriInvoke("create_patient", {})).rejects.toThrow("broken");
        expect(emitWorkflowEventMock).toHaveBeenCalledTimes(2);
        expect(emitWorkflowEventMock).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                phase: "command",
                outcome: "error",
                command: "create_patient",
                detail: "Error",
            }),
        );
    });

    it("does not recursively log workflow command calls", async () => {
        invokeMock.mockResolvedValue(undefined);
        await tauriInvoke("record_workflow_event", { event: { phase: "route" } });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(emitWorkflowEventMock).not.toHaveBeenCalled();
    });
});
