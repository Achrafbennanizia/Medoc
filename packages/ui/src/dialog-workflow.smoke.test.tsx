// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { subscribeWorkflowSteps, type WorkflowStepEvent } from "@/lib/workflow-log-events";
import { Dialog } from "@/views/components/ui/dialog";

describe("Dialog workflow logging", () => {
    it("emits a cancel workflow event on Escape", () => {
        const seen: WorkflowStepEvent[] = [];
        const stop = subscribeWorkflowSteps((event) => {
            seen.push(event);
        });
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose} title="Test Dialog">
                <button type="button">Primary</button>
            </Dialog>,
        );
        fireEvent.keyDown(document, { key: "Escape" });
        stop();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(seen.some((event) => event.workflow === "dialog" && event.status === "cancel")).toBe(
            true,
        );
    });

    it("keeps Escape behavior wired for keyboard accessibility", () => {
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose} title="Keyboard">
                <button type="button">Primary</button>
            </Dialog>,
        );
        const closeButton = screen.getByLabelText(/close|schlie(?:ß|ss)en/i);
        expect(closeButton).toBeInTheDocument();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
