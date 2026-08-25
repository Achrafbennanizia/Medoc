import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
    emitWorkflowEvent,
    WORKFLOW_LOG_COMMAND,
    workflowErrorDetail,
} from "@/services/workflow-logger.service";

describe("workflow logger service", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
        vi.mocked(invoke).mockResolvedValue(undefined as never);
    });

    it("redacts opaque route segments and sensitive details", async () => {
        await emitWorkflowEvent({
            step: "error",
            route: "/patienten/12345678901234567890/rezept",
            detail: "password=hunter2 token=abc123",
            metadata: {
                api_key: "topsecret",
                "bad key": "kept",
            },
        });

        expect(vi.mocked(invoke)).toHaveBeenCalledTimes(1);
        const [command, payload] = vi.mocked(invoke).mock.calls[0];
        expect(command).toBe(WORKFLOW_LOG_COMMAND);
        expect(payload).toMatchObject({
            input: {
                step: "error",
                route: "/patienten/:id/rezept",
            },
        });
        const detail = (payload as { input: { detail: string } }).input.detail;
        expect(detail).toContain("password=***");
        expect(detail).toContain("token=***");
        expect(detail).not.toContain("hunter2");
        expect(detail).not.toContain("abc123");
    });

    it("formats unknown errors safely", () => {
        expect(workflowErrorDetail(new Error("api_key=secret"))).toContain("api_key=***");
        expect(workflowErrorDetail("plain failure")).toBe("plain failure");
    });
});
