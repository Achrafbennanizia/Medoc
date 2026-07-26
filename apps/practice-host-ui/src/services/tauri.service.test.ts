import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

vi.mock("@/services/workflow-log", () => ({
    emitWorkflowEvent: vi.fn().mockResolvedValue(undefined),
}));

import { invoke } from "@tauri-apps/api/core";
import { emitWorkflowEvent } from "@/services/workflow-log";
import { tauriInvoke } from "./tauri.service";

describe("tauriInvoke workflow bridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("emits primary_action and success workflow events", async () => {
        vi.mocked(invoke).mockResolvedValue({ ok: true });

        const result = await tauriInvoke<{ ok: boolean }>("list_patienten", {
            patientId: "p-1",
            include_archived: false,
            optional: undefined,
        });

        expect(result.ok).toBe(true);
        expect(vi.mocked(invoke)).toHaveBeenCalledWith("list_patienten", {
            include_archived: false,
            includeArchived: false,
            patientId: "p-1",
            patient_id: "p-1",
        });
        expect(vi.mocked(emitWorkflowEvent)).toHaveBeenCalledTimes(2);
        expect(vi.mocked(emitWorkflowEvent).mock.calls[0]?.[0]).toMatchObject({
            step: "primary_action",
            action: "list_patienten",
            detail: "invoke",
        });
        expect(vi.mocked(emitWorkflowEvent).mock.calls[1]?.[0]).toMatchObject({
            step: "success",
            action: "list_patienten",
            outcome: "ok",
        });
    });

    it("emits error workflow event and rethrows invoke failures", async () => {
        vi.mocked(invoke).mockRejectedValue(new Error("boom"));

        await expect(tauriInvoke("create_patient", { name: "Alice" })).rejects.toThrow("boom");

        expect(vi.mocked(emitWorkflowEvent)).toHaveBeenCalledTimes(2);
        expect(vi.mocked(emitWorkflowEvent).mock.calls[0]?.[0]).toMatchObject({
            step: "primary_action",
            action: "create_patient",
        });
        expect(vi.mocked(emitWorkflowEvent).mock.calls[1]?.[0]).toMatchObject({
            step: "error",
            action: "create_patient",
            outcome: "failed",
            detail: "Error",
        });
    });

    it("does not recurse for workflow bridge command itself", async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await tauriInvoke("log_workflow_event", {
            event: {
                step: "route_enter",
                route: "/termine",
            },
        });

        expect(vi.mocked(invoke)).toHaveBeenCalledWith("log_workflow_event", {
            event: {
                route: "/termine",
                step: "route_enter",
            },
        });
        expect(vi.mocked(emitWorkflowEvent)).not.toHaveBeenCalled();
    });
});
