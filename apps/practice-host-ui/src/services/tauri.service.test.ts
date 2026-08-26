import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

vi.mock("./workflow-logging.service", () => ({
    emitWorkflowEvent: vi.fn().mockResolvedValue(undefined),
    extractWorkflowErrorMessage: (error: unknown) =>
        error instanceof Error ? error.message : String(error ?? "unknown_error"),
    isCancellationError: (msg: string) =>
        /(cancel|aborted|abgebrochen|user denied|geschlossen)/i.test(msg),
    WORKFLOW_LOG_COMMAND: "log_workflow_event",
}));

import { invoke } from "@tauri-apps/api/core";
import { tauriInvoke } from "./tauri.service";
import { emitWorkflowEvent, WORKFLOW_LOG_COMMAND } from "./workflow-logging.service";

describe("tauri.service tauriInvoke", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
        vi.mocked(emitWorkflowEvent).mockReset();
        vi.mocked(emitWorkflowEvent).mockResolvedValue(undefined);
    });

    it("expands camel/snake args and logs action lifecycle", async () => {
        vi.mocked(invoke).mockResolvedValueOnce({ ok: true });

        await tauriInvoke("create_patient", {
            patient_id: "p-1",
            someValue: 42,
            dropped: undefined,
        });

        expect(invoke).toHaveBeenCalledWith(
            "create_patient",
            expect.objectContaining({
                patient_id: "p-1",
                patientId: "p-1",
                someValue: 42,
                some_value: 42,
            }),
        );
        const payload = vi.mocked(invoke).mock.calls[0][1] as Record<string, unknown>;
        expect(payload).not.toHaveProperty("dropped");

        expect(emitWorkflowEvent).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                workflow: "tauri-ipc",
                step: "primary_action",
                action: "create_patient",
            }),
        );
        expect(emitWorkflowEvent).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                workflow: "tauri-ipc",
                step: "success",
                action: "create_patient",
            }),
        );
    });

    it("emits cancel when invoke rejects with abort-like error", async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error("request aborted by user"));

        await expect(tauriInvoke("sync_run_now")).rejects.toThrow("request aborted by user");

        expect(emitWorkflowEvent).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                workflow: "tauri-ipc",
                step: "cancel",
                action: "sync_run_now",
            }),
        );
    });

    it("does not recurse lifecycle logging for workflow log command", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await tauriInvoke(WORKFLOW_LOG_COMMAND, {
            workflow: "ui-navigation",
            step: "route_enter",
        });

        expect(emitWorkflowEvent).not.toHaveBeenCalled();
        expect(invoke).toHaveBeenCalledWith(
            WORKFLOW_LOG_COMMAND,
            expect.objectContaining({
                workflow: "ui-navigation",
                step: "route_enter",
            }),
        );
    });
});
