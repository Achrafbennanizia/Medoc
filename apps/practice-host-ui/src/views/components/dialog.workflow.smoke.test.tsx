import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog, Dialog } from "@/views/components/ui/dialog";

const WORKFLOW_EVENT_NAME = "medoc-workflow-step";

type WorkflowDetail = {
    workflow?: string;
    step?: string;
    action?: string;
    message?: string;
};

function captureWorkflowEvents() {
    const events: WorkflowDetail[] = [];
    const handler = (event: Event) => {
        events.push(((event as CustomEvent<WorkflowDetail>).detail ?? {}) as WorkflowDetail);
    };
    window.addEventListener(WORKFLOW_EVENT_NAME, handler);
    return {
        events,
        dispose: () => window.removeEventListener(WORKFLOW_EVENT_NAME, handler),
    };
}

describe("Dialog workflow cancel bridge", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    it("emits cancel event on Escape key", () => {
        const onClose = vi.fn();
        const capture = captureWorkflowEvents();
        render(
            <Dialog open onClose={onClose} title="Workflow Dialog">
                <div>Body</div>
            </Dialog>,
        );

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(capture.events.at(-1)).toMatchObject({
            workflow: "dialog",
            step: "cancel",
            action: "escape_key",
            message: "Workflow Dialog",
        });
        capture.dispose();
    });

    it("emits cancel event on backdrop click", () => {
        const onClose = vi.fn();
        const capture = captureWorkflowEvents();
        render(
            <Dialog open onClose={onClose} title="Workflow Dialog">
                <div>Body</div>
            </Dialog>,
        );

        const backdrop = document.querySelector(".modal-backdrop");
        expect(backdrop).not.toBeNull();
        fireEvent.click(backdrop!);

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(capture.events.at(-1)).toMatchObject({
            workflow: "dialog",
            step: "cancel",
            action: "backdrop_click",
            message: "Workflow Dialog",
        });
        capture.dispose();
    });

    it("emits cancel_button event from ConfirmDialog cancel action", () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        const capture = captureWorkflowEvents();
        render(
            <ConfirmDialog
                open
                onClose={onClose}
                onConfirm={onConfirm}
                title="Delete entry"
                message="Confirm delete"
                cancelLabel="Cancel"
                confirmLabel="Confirm"
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
        expect(capture.events.at(-1)).toMatchObject({
            workflow: "dialog",
            step: "cancel",
            action: "cancel_button",
            message: "Delete entry",
        });
        capture.dispose();
    });

    it("confirms dialog on Enter key", () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                onClose={onClose}
                onConfirm={onConfirm}
                title="Delete entry"
                message="Confirm delete"
                cancelLabel="Cancel"
                confirmLabel="Confirm"
            />,
        );

        fireEvent.keyDown(document, { key: "Enter" });

        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });
});
