import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
    emitWorkflowEvent,
    extractWorkflowErrorMessage,
    isCancellationError,
    WORKFLOW_LOG_COMMAND,
} from "./workflow-logging.service";

describe("workflow-logging.service", () => {
    beforeEach(() => {
        vi.mocked(invoke).mockReset();
    });

    it("sends sanitized workflow payload to backend command", async () => {
        vi.mocked(invoke).mockResolvedValueOnce(undefined);

        await emitWorkflowEvent({
            workflow: "  ui   navigation ",
            step: "route_enter",
            route: " /dashboard \n",
            detail: "  hello \n world  ",
        });

        expect(invoke).toHaveBeenCalledWith(
            WORKFLOW_LOG_COMMAND,
            expect.objectContaining({
                workflow: "ui navigation",
                step: "route_enter",
                route: "/dashboard",
                detail: "hello world",
            }),
        );
    });

    it("skips logging when workflow or step is empty", async () => {
        await emitWorkflowEvent({
            workflow: "   ",
            step: "success",
        });

        expect(invoke).not.toHaveBeenCalled();
    });

    it("extracts and classifies cancellation-like errors", () => {
        const msg = extractWorkflowErrorMessage(new Error("request aborted by user"));
        expect(msg).toContain("aborted");
        expect(isCancellationError(msg)).toBe(true);
    });
});
