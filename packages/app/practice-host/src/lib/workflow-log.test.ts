import { describe, expect, it } from "vitest";

import {
    extractWorkflowErrorCode,
    normalizeWorkflowRoute,
    normalizeWorkflowToken,
} from "./workflow-log";

describe("workflow-log helpers", () => {
    it("normalizes workflow tokens to safe lowercase strings", () => {
        expect(normalizeWorkflowToken("  UI Invoke/Create_Patient  ", "fallback")).toBe(
            "ui_invoke/create_patient",
        );
        expect(normalizeWorkflowToken("   ", "fallback")).toBe("fallback");
    });

    it("masks dynamic route identifiers", () => {
        expect(normalizeWorkflowRoute("/")).toBe("/");
        expect(normalizeWorkflowRoute("/patients/seed-pat-001")).toBe("/patients/:id");
        expect(
            normalizeWorkflowRoute(
                "/patients/123e4567-e89b-42d3-a456-426614174000/prescription/new",
            ),
        ).toBe("/patients/:id/prescription/new");
        expect(normalizeWorkflowRoute("/tickets/42/edit")).toBe("/tickets/:id/edit");
    });

    it("extracts coded backend keys from errors", () => {
        expect(
            extractWorkflowErrorCode(
                "Validation failed: error.workflow.task_validate_only_done|status=OPEN",
            ),
        ).toBe("error.workflow.task_validate_only_done");
        expect(extractWorkflowErrorCode(new Error("Something else happened"))).toBe(
            "error.unknown",
        );
    });
});
