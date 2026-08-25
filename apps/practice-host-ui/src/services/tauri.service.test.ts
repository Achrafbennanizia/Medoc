import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { tauriInvoke } from "@/services/tauri.service";
import { WORKFLOW_LOG_COMMAND } from "@/services/workflow-logger.service";

async function flushAsyncLogs(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
}

describe("tauriInvoke workflow instrumentation", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
    });

    it("logs primary_action and success around invoke", async () => {
        vi.mocked(invoke).mockImplementation((command: string) => {
            if (command === WORKFLOW_LOG_COMMAND) {
                return Promise.resolve(undefined as never);
            }
            if (command === "list_patienten") {
                return Promise.resolve([{ id: "p-1" }] as never);
            }
            return Promise.resolve(undefined as never);
        });

        const result = await tauriInvoke<Array<{ id: string }>>("list_patienten", {
            patient_id: "p-1",
            includeArchived: true,
            skipped: undefined,
        });
        await flushAsyncLogs();

        expect(result).toEqual([{ id: "p-1" }]);
        expect(vi.mocked(invoke)).toHaveBeenCalledTimes(3);

        const startPayload = vi.mocked(invoke).mock.calls[0];
        expect(startPayload[0]).toBe(WORKFLOW_LOG_COMMAND);
        expect(startPayload[1]).toMatchObject({
            input: {
                step: "primary_action",
                action: "list_patienten",
                outcome: "invoke_start",
            },
        });

        const commandPayload = vi.mocked(invoke).mock.calls[1];
        expect(commandPayload[0]).toBe("list_patienten");
        expect(commandPayload[1]).toMatchObject({
            patient_id: "p-1",
            patientId: "p-1",
            includeArchived: true,
            include_archived: true,
        });
        expect(commandPayload[1]).not.toHaveProperty("skipped");

        const successPayload = vi.mocked(invoke).mock.calls[2];
        expect(successPayload[0]).toBe(WORKFLOW_LOG_COMMAND);
        expect(successPayload[1]).toMatchObject({
            input: {
                step: "success",
                action: "list_patienten",
                outcome: "invoke_ok",
            },
        });
    });

    it("logs cancel step for cancelled invoke failures", async () => {
        vi.mocked(invoke).mockImplementation((command: string) => {
            if (command === WORKFLOW_LOG_COMMAND) {
                return Promise.resolve(undefined as never);
            }
            if (command === "update_termin") {
                return Promise.reject(new Error("Request cancelled by user"));
            }
            return Promise.resolve(undefined as never);
        });

        await expect(
            tauriInvoke("update_termin", { termin_id: "t-1", status: "ABGESAGT" }),
        ).rejects.toThrow("cancelled");
        await flushAsyncLogs();

        const errorPayload = vi.mocked(invoke).mock.calls[2];
        expect(errorPayload[0]).toBe(WORKFLOW_LOG_COMMAND);
        expect(errorPayload[1]).toMatchObject({
            input: {
                step: "cancel",
                action: "update_termin",
                outcome: "invoke_failed",
            },
        });
    });

    it("does not recurse when workflow command itself is invoked", async () => {
        vi.mocked(invoke).mockResolvedValue(undefined as never);

        await tauriInvoke(WORKFLOW_LOG_COMMAND, {
            input: { step: "route_enter", route: "/patienten" },
        });

        expect(vi.mocked(invoke)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(invoke)).toHaveBeenCalledWith(WORKFLOW_LOG_COMMAND, {
            input: { step: "route_enter", route: "/patienten" },
        });
    });
});
