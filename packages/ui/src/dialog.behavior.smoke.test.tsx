/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog, Dialog } from "./dialog";

afterEach(() => {
    cleanup();
});

describe("Dialog behavior", () => {
    it("closes on Escape and backdrop click", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        const { container, rerender } = render(
            <Dialog open onClose={onClose} title="Edit">
                <button type="button">First</button>
                <button type="button">Second</button>
            </Dialog>,
        );

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);

        rerender(
            <Dialog open onClose={onClose} title="Edit">
                <button type="button">First</button>
                <button type="button">Second</button>
            </Dialog>,
        );

        const backdrop = container.querySelector(".modal-backdrop");
        expect(backdrop).not.toBeNull();
        await user.click(backdrop as HTMLElement);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it("keeps focus trapped with Tab cycling", async () => {
        const user = userEvent.setup();
        render(
            <Dialog open onClose={() => {}} title="Trap">
                <button type="button">First</button>
                <button type="button">Second</button>
            </Dialog>,
        );

        await waitFor(() => {
            expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
        });

        await user.tab();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "Second" }));
        await user.tab();
        expect(document.activeElement).toBe(screen.getByRole("button", { name: "First" }));
    });
});

describe("ConfirmDialog behavior", () => {
    it("wires cancel and confirm actions", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onConfirm = vi.fn();

        render(
            <ConfirmDialog
                open
                title="Delete patient"
                message="This action cannot be undone"
                onClose={onClose}
                onConfirm={onConfirm}
                confirmLabel="Delete"
                cancelLabel="Abort"
            />,
        );

        await user.click(screen.getByRole("button", { name: "Abort" }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "Delete" }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("confirms with Enter key for keyboard-first flow", () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                title="Delete patient"
                message="This action cannot be undone"
                onClose={onClose}
                onConfirm={onConfirm}
                confirmLabel="Delete"
                cancelLabel="Abort"
            />,
        );

        fireEvent.keyDown(document, { key: "Enter" });
        expect(onConfirm).toHaveBeenCalledTimes(1);
        expect(onClose).not.toHaveBeenCalled();
    });
});
