import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { tauriInvoke } from "./tauri.service";
import { WORKFLOW_EVENT_COMMAND } from "./workflow-event.service";

type WorkflowEventInvokePayload = {
    event?: {
        stage?: string;
    };
};

describe("tauriInvoke workflow instrumentation", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
    });

    it("logs primary/success workflow events and expands invoke args", async () => {
        vi.mocked(invoke).mockImplementation(async (cmd, args) => {
            if (cmd === WORKFLOW_EVENT_COMMAND) return undefined as never;
            expect(args).toEqual({ patient_id: "pat-1", patientId: "pat-1" });
            return { ok: true } as never;
        });

        const result = await tauriInvoke<{ ok: boolean }>("get_patient", {
            patient_id: "pat-1",
            dropped: undefined,
        });

        expect(result.ok).toBe(true);
        const workflowCalls = vi
            .mocked(invoke)
            .mock.calls.filter(([cmd]) => cmd === WORKFLOW_EVENT_COMMAND);
        const stages = workflowCalls
            .map(([, payload]) => (payload as WorkflowEventInvokePayload).event?.stage)
            .filter((stage): stage is string => typeof stage === "string");
        expect(stages).toContain("primary_action");
        expect(stages).toContain("success");
    });

    it("logs error workflow stage when command fails", async () => {
        vi.mocked(invoke).mockImplementation(async (cmd) => {
            if (cmd === WORKFLOW_EVENT_COMMAND) return undefined as never;
            throw new Error("boom");
        });

        await expect(tauriInvoke("set_log_level", { level: "DEBUG" })).rejects.toThrow("boom");

        const workflowCalls = vi
            .mocked(invoke)
            .mock.calls.filter(([cmd]) => cmd === WORKFLOW_EVENT_COMMAND);
        const stages = workflowCalls
            .map(([, payload]) => (payload as WorkflowEventInvokePayload).event?.stage)
            .filter((stage): stage is string => typeof stage === "string");
        expect(stages).toContain("primary_action");
        expect(stages).toContain("error");
    });
});
