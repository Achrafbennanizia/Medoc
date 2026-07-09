import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

vi.mock("@/systems/practice-host/lib/workflow-log", () => ({
    WORKFLOW_LOG_COMMAND: "log_workflow_event",
    logPrimaryAction: vi.fn(),
    logActionSuccess: vi.fn(),
    logActionError: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
    logActionError,
    logActionSuccess,
    logPrimaryAction,
    WORKFLOW_LOG_COMMAND,
} from "@/systems/practice-host/lib/workflow-log";
import { tauriInvoke } from "./tauri.service";

describe("tauriInvoke", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
        vi.mocked(logPrimaryAction).mockReset();
        vi.mocked(logActionSuccess).mockReset();
        vi.mocked(logActionError).mockReset();
    });

    it("logs primary-action/success and expands dual-case invoke args", async () => {
        vi.mocked(invoke).mockResolvedValueOnce("ok");

        await expect(
            tauriInvoke<string>("create_patient", {
                patient_id: "pat-1",
                fooBar: 7,
                skip: undefined,
            }),
        ).resolves.toBe("ok");

        expect(logPrimaryAction).toHaveBeenCalledWith("create_patient", {
            patient_id: "pat-1",
            fooBar: 7,
        });
        expect(invoke).toHaveBeenCalledWith("create_patient", {
            patient_id: "pat-1",
            patientId: "pat-1",
            fooBar: 7,
            foo_bar: 7,
        });
        expect(logActionSuccess).toHaveBeenCalledWith("create_patient");
        expect(logActionError).not.toHaveBeenCalled();
    });

    it("logs error lifecycle when invoke fails", async () => {
        const err = new Error("boom");
        vi.mocked(invoke).mockRejectedValueOnce(err);

        await expect(tauriInvoke("delete_patient")).rejects.toThrow("boom");

        expect(logPrimaryAction).toHaveBeenCalledWith("delete_patient", {});
        expect(logActionSuccess).not.toHaveBeenCalled();
        expect(logActionError).toHaveBeenCalledWith("delete_patient", err);
    });

    it("does not recursively log workflow channel writes", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await tauriInvoke(WORKFLOW_LOG_COMMAND, {
            event: { step: "route_enter", route: "/" },
        });

        expect(logPrimaryAction).not.toHaveBeenCalled();
        expect(logActionSuccess).not.toHaveBeenCalled();
        expect(logActionError).not.toHaveBeenCalled();
    });
});
