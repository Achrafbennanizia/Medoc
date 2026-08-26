// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { ConfirmDialog, Dialog } from "./dialog";
import { EmptyState } from "./empty-state";
import { IconButton } from "./icon-button";
import { Input } from "./input";

describe("ui library event behavior", () => {
    it("button and icon button dispatch click handlers and disabled state", async () => {
        const user = userEvent.setup();
        const onPrimaryClick = vi.fn();
        const onIconClick = vi.fn();

        render(
            <>
                <Button onClick={onPrimaryClick}>Save</Button>
                <Button disabled onClick={onPrimaryClick}>
                    Disabled
                </Button>
                <IconButton aria-label="Open menu" onClick={onIconClick}>
                    <span aria-hidden>☰</span>
                </IconButton>
            </>,
        );

        await user.click(screen.getByRole("button", { name: "Save" }));
        await user.click(screen.getByRole("button", { name: "Disabled" }));
        await user.click(screen.getByRole("button", { name: "Open menu" }));

        expect(onPrimaryClick).toHaveBeenCalledTimes(1);
        expect(onIconClick).toHaveBeenCalledTimes(1);
    });

    it("input reacts to change and exposes error state", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <Input
                label="Email"
                hint="Use your work email"
                error="Email is required"
                onChange={onChange}
            />,
        );

        const input = screen.getByLabelText("Email");
        await user.type(input, "a@b.de");

        expect(onChange).toHaveBeenCalled();
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByText("Email is required")).toBeInTheDocument();
    });

    it("dialog supports keyboard escape and confirm enter", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onConfirm = vi.fn();

        render(
            <>
                <Dialog open onClose={onClose} title="Edit patient">
                    <button type="button">Focusable</button>
                </Dialog>
                <ConfirmDialog
                    open
                    onClose={onClose}
                    onConfirm={onConfirm}
                    title="Delete entry"
                    message="This cannot be undone."
                    confirmLabel="Confirm"
                    cancelLabel="Cancel"
                />
            </>,
        );

        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalled();

        const confirm = screen.getByRole("button", { name: "Confirm" });
        confirm.focus();
        await user.keyboard("{Enter}");
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("empty state actions fire for primary and secondary buttons", async () => {
        const user = userEvent.setup();
        const onPrimary = vi.fn();
        const onSecondary = vi.fn();

        render(
            <EmptyState
                title="No appointments"
                description="Create your first appointment."
                action={{ label: "Create", onClick: onPrimary }}
                secondaryAction={{ label: "Dismiss", onClick: onSecondary }}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Create" }));
        await user.click(screen.getByRole("button", { name: "Dismiss" }));

        expect(onPrimary).toHaveBeenCalledTimes(1);
        expect(onSecondary).toHaveBeenCalledTimes(1);
    });
});
