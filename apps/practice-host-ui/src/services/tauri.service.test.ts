import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { tauriInvoke } from "./tauri.service";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

describe("tauriInvoke workflow bridge", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
    });

    it("emits workflow start/success around command calls", async () => {
        vi.mocked(invoke).mockImplementation(async (cmd: string) => {
            if (cmd === "log_workflow_event") {
                return undefined as never;
            }
            return { ok: true } as never;
        });

        await tauriInvoke("list_patients", { limit: 5 });

        expect(invoke).toHaveBeenCalledTimes(3);
        expect(invoke).toHaveBeenNthCalledWith(
            1,
            "log_workflow_event",
            expect.objectContaining({
                stage: "primary_action",
                action: "list_patients",
            }),
        );
        expect(invoke).toHaveBeenNthCalledWith(
            2,
            "list_patients",
            expect.objectContaining({ limit: 5 }),
        );
        expect(invoke).toHaveBeenNthCalledWith(
            3,
            "log_workflow_event",
            expect.objectContaining({
                stage: "success",
                action: "list_patients",
            }),
        );
    });
});
