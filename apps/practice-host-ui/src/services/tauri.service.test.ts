import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { logWorkflowCancel, logWorkflowRouteEnter, tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("tauri.service workflow bridge", () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it("normalizes args and emits primary/success workflow events", async () => {
        invokeMock.mockImplementation(async (cmd) => {
            if (cmd === "log_workflow_event") {
                return undefined;
            }
            return { ok: true };
        });

        const result = await tauriInvoke<{ ok: boolean }>("do_something", {
            patient_id: "pat-1",
            fooBar: 7,
            ignored: undefined,
        });

        expect(result).toEqual({ ok: true });
        expect(invokeMock).toHaveBeenCalledTimes(3);
        expect(invokeMock.mock.calls[1]?.[0]).toBe("do_something");
        expect(invokeMock.mock.calls[1]?.[1]).toMatchObject({
            patient_id: "pat-1",
            patientId: "pat-1",
            fooBar: 7,
            foo_bar: 7,
        });
        expect((invokeMock.mock.calls[0]?.[1] as { event: { stage: string } }).event.stage).toBe(
            "primary_action",
        );
        expect((invokeMock.mock.calls[2]?.[1] as { event: { stage: string } }).event.stage).toBe(
            "success",
        );
    });

    it("emits workflow error event when command invoke fails", async () => {
        invokeMock.mockImplementation(async (cmd) => {
            if (cmd === "log_workflow_event") {
                return undefined;
            }
            throw new Error("boom");
        });

        await expect(tauriInvoke("broken_command", { token: "secret" })).rejects.toThrow("boom");
        expect(invokeMock).toHaveBeenCalledTimes(3);
        const errorPayload = invokeMock.mock.calls[2]?.[1] as {
            event: { stage: string; message?: string };
        };
        expect(errorPayload.event.stage).toBe("error");
        expect(errorPayload.event.message).toContain("boom");
    });

    it("does not recurse when bridge command is invoked directly", async () => {
        invokeMock.mockResolvedValue(undefined);
        await tauriInvoke("log_workflow_event", { event: { stage: "route_enter" } });
        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock.mock.calls[0]?.[0]).toBe("log_workflow_event");
    });

    it("exposes route enter and cancel helpers", async () => {
        invokeMock.mockResolvedValue(undefined);
        await logWorkflowRouteEnter("/patienten");
        await logWorkflowCancel("logout", "dialog_close");

        expect(invokeMock).toHaveBeenCalledTimes(2);
        expect((invokeMock.mock.calls[0]?.[1] as { event: { stage: string } }).event.stage).toBe(
            "route_enter",
        );
        expect((invokeMock.mock.calls[1]?.[1] as { event: { stage: string } }).event.stage).toBe(
            "cancel",
        );
    });
});
