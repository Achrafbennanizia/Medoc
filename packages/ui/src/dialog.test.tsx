// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog, IosConfirmActions } from "./dialog";

describe("Dialog", () => {
    afterEach(() => {
        cleanup();
    });

    it("supports escape + backdrop dismissal and exposes an accessible close button", async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();

        render(
            <Dialog open onClose={onClose} title="Example dialog">
                <button type="button">Primary action</button>
            </Dialog>,
        );

        const closeButton = screen.getByRole("button", { name: /close/i });
        expect(closeButton).toBeVisible();

        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);

        const backdrop = document.body.querySelector(".modal-backdrop");
        expect(backdrop).toBeTruthy();
        await user.click(backdrop!);
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});

describe("IosConfirmActions", () => {
    afterEach(() => {
        cleanup();
    });

    it("fires cancel and confirm handlers via keyboard Enter", async () => {
        const onCancel = vi.fn();
        const onConfirm = vi.fn();
        const user = userEvent.setup();

        render(
            <IosConfirmActions
                cancelLabel="Cancel"
                confirmLabel="Confirm"
                onCancel={onCancel}
                onConfirm={onConfirm}
            />,
        );

        const cancelButton = screen.getByRole("button", { name: "Cancel" });
        const confirmButton = screen.getByRole("button", { name: "Confirm" });

        cancelButton.focus();
        await user.keyboard("{Enter}");
        expect(onCancel).toHaveBeenCalledTimes(1);

        confirmButton.focus();
        await user.keyboard("{Enter}");
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("keeps actions disabled while loading", () => {
        render(
            <IosConfirmActions
                cancelLabel="Cancel"
                confirmLabel="Confirm"
                onCancel={vi.fn()}
                onConfirm={vi.fn()}
                loading
            />,
        );

        const cancelButtons = screen.getAllByRole("button", { name: "Cancel" });
        const confirmButtons = screen.getAllByRole("button", { name: "…" });
        expect(cancelButtons).toHaveLength(1);
        expect(confirmButtons).toHaveLength(1);
        expect(cancelButtons[0]).toBeDisabled();
        expect(confirmButtons[0]).toBeDisabled();
    });
});
