import { beforeEach, describe, expect, it, vi } from "vitest";
import { tauriInvoke } from "./tauri.service";

const mockInvoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe("tauriInvoke workflow logging bridge", () => {
    beforeEach(() => {
        mockInvoke.mockReset();
    });

    it("emits primary_action and success workflow events around command invoke", async () => {
        mockInvoke.mockImplementation(async (cmd: string) => {
            if (cmd === "create_patient") return { ok: true };
            return undefined;
        });

        await expect(
            tauriInvoke<{ ok: boolean }>("create_patient", {
                patient_id: "abc",
                optional: undefined,
            }),
        ).resolves.toEqual({ ok: true });

        expect(mockInvoke).toHaveBeenCalledTimes(3);

        const primaryEvent = mockInvoke.mock.calls[0]?.[1] as { event: { step: string } };
        expect(mockInvoke.mock.calls[0]?.[0]).toBe("log_workflow_event");
        expect(primaryEvent.event.step).toBe("primary_action");

        expect(mockInvoke.mock.calls[1]?.[0]).toBe("create_patient");
        expect(mockInvoke.mock.calls[1]?.[1]).toEqual({
            patient_id: "abc",
            patientId: "abc",
        });

        const successEvent = mockInvoke.mock.calls[2]?.[1] as { event: { step: string } };
        expect(mockInvoke.mock.calls[2]?.[0]).toBe("log_workflow_event");
        expect(successEvent.event.step).toBe("success");
    });

    it("emits cancel when invoke fails with aborted wording", async () => {
        mockInvoke.mockImplementation(async (cmd: string) => {
            if (cmd === "pick_export_directory") {
                throw new Error("User canceled picker");
            }
            return undefined;
        });

        await expect(tauriInvoke("pick_export_directory")).rejects.toThrow(
            "User canceled picker",
        );

        const cancelEvent = mockInvoke.mock.calls.at(-1)?.[1] as {
            event: { step: string };
        };
        expect(cancelEvent.event.step).toBe("cancel");
    });

    it("does not recurse when invoking workflow logging command directly", async () => {
        mockInvoke.mockResolvedValue(undefined);

        await expect(
            tauriInvoke("log_workflow_event", {
                event: { step: "route_enter", route: "/patients", action: "route_change" },
            }),
        ).resolves.toBeUndefined();

        expect(mockInvoke).toHaveBeenCalledTimes(1);
        expect(mockInvoke.mock.calls[0]?.[0]).toBe("log_workflow_event");
    });
});
