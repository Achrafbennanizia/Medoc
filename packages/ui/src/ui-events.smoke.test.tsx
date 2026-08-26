/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import * as axeMatchers from "vitest-axe/matchers";

import { Button } from "./button";
import { ConfirmDialog, Dialog } from "./dialog";
import { DismissibleNotice } from "./dismissible-notice";
import { EmptyState } from "./empty-state";
import { FilterOptionBar } from "./filter-option-bar";
import { Input, Select, Textarea } from "./input";
import { TagInput } from "./tag-input";
import { TimeSlotPicker } from "./time-slot-picker";

expect.extend(axeMatchers);

afterEach(() => {
    cleanup();
});

describe("packages/ui component event behavior", () => {
    it("handles click + disabled/loading button state", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Save</Button>);
        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(onClick).toHaveBeenCalledTimes(1);

        render(
            <Button loading onClick={onClick}>
                Busy
            </Button>,
        );
        const busy = screen.getByRole("button", { name: "Busy" });
        expect(busy).toBeDisabled();
    });

    it("supports input/change for Input, Select and Textarea", async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(
            <>
                <Input label="Name" />
                <Select
                    label="Role"
                    options={[
                        { value: "arzt", label: "Arzt" },
                        { value: "rez", label: "Rezeption" },
                    ]}
                    onChange={onSelect}
                />
                <Textarea label="Notes" />
            </>,
        );

        await user.type(screen.getByLabelText("Name"), "Alice");
        expect(screen.getByLabelText("Name")).toHaveValue("Alice");

        await user.click(screen.getByRole("button", { name: "Role" }));
        await user.click(screen.getByRole("option", { name: "Rezeption" }));
        expect(onSelect).toHaveBeenCalled();

        await user.type(screen.getByLabelText("Notes"), "Follow up");
        expect(screen.getByLabelText("Notes")).toHaveValue("Follow up");
    });

    it("supports tag add/remove and suggestion click flows", async () => {
        const user = userEvent.setup();
        let tags: string[] = [];
        const onChange = vi.fn((next: string[]) => {
            tags = next;
            rerender(<TagInput label="Tags" value={tags} onChange={onChange} suggestions={["Recall"]} />);
        });

        const { rerender } = render(
            <TagInput label="Tags" value={tags} onChange={onChange} suggestions={["Recall"]} />,
        );
        const input = screen.getByLabelText("Tags");

        await user.type(input, "Urgent");
        await user.keyboard("{Enter}");
        expect(onChange).toHaveBeenCalled();
        expect(screen.getByText("Urgent")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "+ Recall" }));
        expect(screen.getByText("Recall")).toBeInTheDocument();

        await user.click(screen.getAllByRole("button", { name: /remove/i })[0]);
        expect(onChange).toHaveBeenCalledTimes(3);
    });

    it("handles option click, disabled and empty states in time picker", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const busy = new Set(["2026-08-26|09:00"]);
        render(
            <TimeSlotPicker
                value=""
                onChange={onChange}
                selectedDate="2026-08-26"
                slots={["09:00", "09:30"]}
                busyKeys={busy}
            />,
        );

        expect(screen.getByRole("button", { name: "09:00" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "09:30" }));
        expect(onChange).toHaveBeenCalledWith("09:30");

        render(
            <TimeSlotPicker
                value=""
                onChange={onChange}
                selectedDate="2026-08-26"
                slots={[]}
                emptyLabel="No slots"
            />,
        );
        expect(screen.getByText("No slots")).toBeInTheDocument();
    });

    it("supports dismiss action and empty-state CTA actions", async () => {
        const user = userEvent.setup();
        const dismiss = vi.fn();
        const primary = vi.fn();
        const secondary = vi.fn();
        render(
            <>
                <DismissibleNotice title="Notice" dismissKey="notice-key" onDismiss={dismiss} />
                <EmptyState
                    title="No data"
                    description="Try loading"
                    action={{ label: "Retry", onClick: primary }}
                    secondaryAction={{ label: "Cancel", onClick: secondary }}
                />
            </>,
        );

        await user.click(screen.getByRole("button", { name: /close/i }));
        expect(dismiss).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole("button", { name: "Retry" }));
        await user.click(screen.getByRole("button", { name: "Cancel" }));
        expect(primary).toHaveBeenCalledTimes(1);
        expect(secondary).toHaveBeenCalledTimes(1);
    });

    it("supports keyboard Tab, Enter and Escape for dialogs", async () => {
        const user = userEvent.setup();
        const close = vi.fn();
        const confirm = vi.fn();
        render(
            <Dialog
                open
                onClose={close}
                title="Dialog"
                footer={
                    <>
                        <button type="button">Secondary</button>
                        <button type="button">Primary</button>
                    </>
                }
            >
                <input aria-label="Field" />
            </Dialog>,
        );

        await user.tab();
        expect(screen.getByLabelText("Field")).toHaveFocus();
        await user.tab();
        expect(screen.getByRole("button", { name: "Secondary" })).toHaveFocus();

        await user.keyboard("{Escape}");
        expect(close).toHaveBeenCalledTimes(1);

        render(
            <ConfirmDialog
                open
                onClose={close}
                onConfirm={confirm}
                title="Delete?"
                message="Confirm action"
                confirmLabel="Confirm now"
                cancelLabel="Back"
            />,
        );
        const confirmBtn = screen.getByRole("button", { name: "Confirm now" });
        await Promise.resolve();
        confirmBtn.focus();
        expect(confirmBtn).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(confirm).toHaveBeenCalledTimes(1);
    });

    it("has no critical axe violations on representative UI states", async () => {
        const { container } = render(
            <>
                <Input label="Patient" hint="Required" />
                <FilterOptionBar
                    ariaLabel="Filters"
                    value="all"
                    onChange={() => {}}
                    options={[
                        { value: "all", label: "All" },
                        { value: "open", label: "Open" },
                    ]}
                />
                <DismissibleNotice title="Heads up" subtitle="Check data" closable={false} />
            </>,
        );
        const result = await axe(container);
        expect(result).toHaveNoViolations();
    });
});
