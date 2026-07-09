import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog, Dialog } from "./dialog";

describe("dialog behavior", () => {
    it("closes dialog with Escape", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose} title="Dialog title">
                Body
            </Dialog>,
        );

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps cancel available during loading in confirm dialog", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                onClose={onClose}
                onConfirm={onConfirm}
                title="Confirm action"
                message="Please confirm."
                confirmLabel="Confirm"
                cancelLabel="Cancel"
                loading
            />,
        );

        const cancelButton = screen.getByRole("button", { name: "Cancel" });
        const confirmButton = screen.getByRole("button", { name: "…" });
        expect(cancelButton).toBeEnabled();
        expect(confirmButton).toBeDisabled();

        await user.click(cancelButton);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("supports Enter on primary confirm action", async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                onClose={vi.fn()}
                onConfirm={onConfirm}
                title="Confirm action"
                message="Please confirm."
                confirmLabel="Confirm"
                cancelLabel="Cancel"
            />,
        );

        await user.tab();
        await user.keyboard("{Enter}");
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});
