/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog, Dialog } from "./dialog";
import { logWorkflowCancel } from "@/services/workflow.service";

vi.mock("@/services/workflow.service", () => ({
    logWorkflowCancel: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Dialog workflow behavior", () => {
    it("closes via Escape and logs cancel reason", () => {
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose} title="Workflow dialog">
                <button type="button">Primary action</button>
            </Dialog>,
        );

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(logWorkflowCancel).toHaveBeenCalledWith("dialog_escape", "Workflow dialog");
    });

    it("closes via backdrop click and logs cancel reason", () => {
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose} title="Backdrop dialog">
                <button type="button">Primary action</button>
            </Dialog>,
        );

        fireEvent.click(screen.getByRole("presentation"));

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(logWorkflowCancel).toHaveBeenCalledWith("dialog_backdrop", "Backdrop dialog");
    });

    it("keeps confirm dialog open while loading (cancel disabled)", () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                onClose={onClose}
                onConfirm={onConfirm}
                title="Delete item"
                message="This cannot be undone."
                loading
            />,
        );

        const cancelButton = screen.getByRole("button", { name: /cancel|common\.cancel/i });
        expect(cancelButton).toBeDisabled();
        fireEvent.click(cancelButton);

        expect(onClose).not.toHaveBeenCalled();
    });

    it("submits confirm action with Enter key", async () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                onClose={onClose}
                onConfirm={onConfirm}
                title="Apply action"
                message="Confirm now."
            />,
        );

        const confirmButton = screen.getByRole("button", {
            name: /confirm|common\.confirm/i,
        });
        fireEvent.keyDown(confirmButton, { key: "Enter" });

        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
