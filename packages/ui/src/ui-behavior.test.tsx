// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type FormEvent, useState } from "react";
import { Button } from "./button";
import { Dialog, ConfirmDialog } from "./dialog";
import { EmptyState } from "./empty-state";
import { Input, Select, Textarea } from "./input";
import { PageLoadError, PageLoading } from "./page-status";
import { TagInput } from "./tag-input";
import { TimeSlotPicker } from "./time-slot-picker";

afterEach(() => {
    cleanup();
});

describe("ui behavior matrix", () => {
    it("handles button click and loading-disabled state", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        const { rerender } = render(<Button onClick={onClick}>Save</Button>);
        const button = screen.getByRole("button", { name: "Save" });

        await user.click(button);
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(button).not.toBeDisabled();

        rerender(
            <Button onClick={onClick} loading>
                Save
            </Button>,
        );
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    });

    it("wires input and textarea change events and renders error state", async () => {
        const user = userEvent.setup();
        const onInput = vi.fn();
        const onText = vi.fn();
        render(
            <>
                <Input
                    label="Email"
                    value=""
                    onChange={onInput}
                    error="Required"
                    hint="Use your practice email"
                />
                <Textarea
                    label="Notes"
                    value=""
                    onChange={onText}
                    error="Missing note"
                />
            </>,
        );

        const email = screen.getByLabelText("Email");
        const notes = screen.getByLabelText("Notes");
        expect(email).toHaveAttribute("aria-invalid", "true");
        expect(notes).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByText("Use your practice email")).toBeInTheDocument();

        await user.type(email, "a");
        await user.type(notes, "x");
        expect(onInput).toHaveBeenCalled();
        expect(onText).toHaveBeenCalled();
    });

    it("supports select choice changes via custom listbox", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <Select
                label="Status"
                value="OPEN"
                onChange={onChange}
                options={[
                    { value: "OPEN", label: "Open" },
                    { value: "DONE", label: "Done" },
                ]}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Status" }));
        await user.click(screen.getByRole("option", { name: "Done" }));
        expect(onChange).toHaveBeenCalled();
    });

    it("submits form on Enter key", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
        render(
            <form onSubmit={onSubmit}>
                <Input label="Username" defaultValue="" />
                <button type="submit">Submit</button>
            </form>,
        );

        await user.type(screen.getByLabelText("Username"), "medoc{Enter}");
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("adds and removes tags with keyboard and click", async () => {
        const user = userEvent.setup();
        const Wrapper = () => {
            const [tags, setTags] = useState<string[]>([]);
            return (
                <TagInput
                    label="Tags"
                    value={tags}
                    onChange={setTags}
                    suggestions={["Pain", "Follow-up"]}
                />
            );
        };
        render(<Wrapper />);

        const input = screen.getByLabelText("Tags");
        await user.type(input, "Pain{Enter}");
        expect(screen.getByText("Pain")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /remove pain/i }));
        expect(screen.queryByText("Pain")).not.toBeInTheDocument();
    });

    it("renders empty and disabled time-slot states", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const { rerender } = render(
            <TimeSlotPicker
                value=""
                onChange={onChange}
                selectedDate="2026-08-26"
                slots={[]}
                emptyLabel="No slots"
            />,
        );

        expect(screen.getByText("No slots")).toBeInTheDocument();

        rerender(
            <TimeSlotPicker
                value="09:00"
                onChange={onChange}
                selectedDate="2026-08-26"
                slots={["09:00", "09:30"]}
                busyKeys={new Set(["2026-08-26|09:30"])}
            />,
        );
        expect(screen.getByRole("button", { name: "09:30" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "09:00" }));
        expect(onChange).toHaveBeenCalledWith("09:00");
    });

    it("supports dialog keyboard dismissal (Escape) and cancel telemetry event", async () => {
        const onClose = vi.fn();
        const workflowSpy = vi.fn();
        window.addEventListener("medoc:workflow-step", workflowSpy as EventListener);

        render(
            <Dialog open onClose={onClose} title="Confirm">
                <button type="button">First</button>
                <button type="button">Second</button>
            </Dialog>,
        );

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(workflowSpy).toHaveBeenCalled();
        const event = workflowSpy.mock.calls[0]?.[0] as CustomEvent<{ stage?: string; step?: string }>;
        expect(event.detail?.stage).toBe("cancel");
        expect(event.detail?.step).toBe("dialog-escape");
        window.removeEventListener("medoc:workflow-step", workflowSpy as EventListener);
    });

    it("supports tab/enter keyboard flow on confirm dialog actions", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        render(
            <ConfirmDialog
                open
                onClose={onClose}
                onConfirm={onConfirm}
                title="Delete item"
                message="Do you want to delete?"
                confirmLabel="Confirm delete"
                cancelLabel="Abort"
            />,
        );

        await user.tab();
        const dialog = screen.getByRole("dialog");
        expect(dialog.contains(document.activeElement)).toBe(true);
        const confirm = screen.getByRole("button", { name: "Confirm delete" });
        confirm.focus();
        expect(confirm).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("renders loading, error retry, and empty-state actions", async () => {
        const user = userEvent.setup();
        const onRetry = vi.fn();
        const onPrimary = vi.fn();
        const onSecondary = vi.fn();

        render(
            <>
                <PageLoading label="Loading workflow" />
                <PageLoadError message="Unable to load" onRetry={onRetry} />
                <EmptyState
                    title="Nothing here"
                    description="Start by adding an entry"
                    action={{ label: "Create", onClick: onPrimary }}
                    secondaryAction={{ label: "Dismiss", onClick: onSecondary }}
                />
            </>,
        );

        const loading = screen.getByText("Loading workflow").closest('[role="status"]');
        expect(loading).not.toBeNull();
        expect(loading).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("alert")).toHaveTextContent("Unable to load");

        await user.click(screen.getByRole("button", { name: /retry|try again/i }));
        await user.click(screen.getByRole("button", { name: "Create" }));
        await user.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onPrimary).toHaveBeenCalledTimes(1);
        expect(onSecondary).toHaveBeenCalledTimes(1);
    });
});
