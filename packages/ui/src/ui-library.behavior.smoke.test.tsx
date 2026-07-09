import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Badge } from "@/views/components/ui/badge";
import { Button } from "@/views/components/ui/button";
import { Card, CardHeader } from "@/views/components/ui/card";
import { ConfirmDialog, Dialog } from "@/views/components/ui/dialog";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { EmptyState } from "@/views/components/ui/empty-state";
import { FilterOptionBar } from "@/views/components/ui/filter-option-bar";
import { FormSection } from "@/views/components/ui/form-section";
import { IconButton } from "@/views/components/ui/icon-button";
import { Input, Select, Textarea } from "@/views/components/ui/input";
import { PageLoadError, PageLoading } from "@/views/components/ui/page-status";
import { Separator } from "@/views/components/ui/separator";
import { Skeleton } from "@/views/components/ui/skeleton";
import { Spinner } from "@/views/components/ui/spinner";
import { TagInput } from "@/views/components/ui/tag-input";
import { TimeSlotPicker } from "@/views/components/ui/time-slot-picker";

describe("ui library behavior matrix", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });
    afterEach(() => {
        cleanup();
    });

    it("handles click/disabled/loading for buttons and icon buttons", async () => {
        const user = userEvent.setup();
        const onButtonClick = vi.fn();
        const onIconClick = vi.fn();

        render(
            <div>
                <Button onClick={onButtonClick}>Save</Button>
                <Button loading onClick={onButtonClick}>
                    Busy
                </Button>
                <Button disabled onClick={onButtonClick}>
                    Disabled
                </Button>
                <IconButton aria-label="Close panel" onClick={onIconClick}>
                    x
                </IconButton>
            </div>,
        );

        await user.click(screen.getByRole("button", { name: "Save" }));
        await user.click(screen.getByRole("button", { name: "Busy" }));
        await user.click(screen.getByRole("button", { name: "Disabled" }));
        await user.click(screen.getByRole("button", { name: "Close panel" }));

        expect(onButtonClick).toHaveBeenCalledTimes(1);
        expect(onIconClick).toHaveBeenCalledTimes(1);
    });

    it("handles input/change for Input, Select, and Textarea", async () => {
        const user = userEvent.setup();
        const onSelectChange = vi.fn();
        const onTextChange = vi.fn();

        function SelectHarness() {
            const [value, setValue] = useState("a");
            return (
                <Select
                    aria-label="Mode"
                    options={[
                        { value: "a", label: "Alpha" },
                        { value: "b", label: "Beta" },
                    ]}
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        onSelectChange(e.target.value);
                    }}
                />
            );
        }

        function TextHarness() {
            const [value, setValue] = useState("");
            return (
                <Textarea
                    label="Notes"
                    value={value}
                    onChange={(e) => {
                        setValue(e.target.value);
                        onTextChange(e.target.value);
                    }}
                />
            );
        }

        render(
            <div>
                <Input label="Email" error="Email is required" defaultValue="" />
                <SelectHarness />
                <TextHarness />
            </div>,
        );

        const input = screen.getByLabelText("Email");
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByText("Email is required")).toBeInTheDocument();

        await user.type(input, "alice@example.org");
        expect(input).toHaveValue("alice@example.org");

        await user.click(screen.getByRole("button", { name: "Alpha" }));
        await user.click(screen.getByRole("option", { name: "Beta" }));
        expect(onSelectChange).toHaveBeenCalledWith("b");

        await user.type(screen.getByLabelText("Notes"), "new note");
        expect(onTextChange).toHaveBeenLastCalledWith("new note");
    });

    it("supports submit/error keyboard flow in dialogs (Tab, Enter, Escape)", async () => {
        const user = userEvent.setup();
        const onConfirm = vi.fn();
        const onClose = vi.fn();

        render(
            <ConfirmDialog
                open
                title="Delete item"
                message="This cannot be undone."
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        const cancel = screen.getByRole("button", { name: "Cancel" });
        await waitFor(() => expect(cancel).toHaveFocus());

        await user.tab();
        const confirm = screen.getByRole("button", { name: "Confirm" });
        expect(confirm).toHaveFocus();

        await user.keyboard("{Enter}");
        expect(onConfirm).toHaveBeenCalledTimes(1);

        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("supports dismissing dialogs with Escape", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        render(
            <Dialog open title="Dialog title" onClose={onClose}>
                <button type="button">Inside action</button>
            </Dialog>,
        );

        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("handles tag input add/remove and suggestion click", async () => {
        const user = userEvent.setup();

        function TagHarness() {
            const [value, setValue] = useState<string[]>([]);
            return (
                <TagInput
                    label="Tags"
                    value={value}
                    onChange={setValue}
                    suggestions={["Toothache", "Caries"]}
                />
            );
        }

        render(<TagHarness />);
        const field = screen.getByLabelText("Tags");
        await user.type(field, "Headache{Enter}");
        expect(screen.getByText("Headache")).toBeInTheDocument();

        const chip = screen.getByText("Headache").closest(".tag-chip");
        expect(chip).not.toBeNull();
        await user.click(within(chip as HTMLElement).getByRole("button"));
        expect(screen.queryByText("Headache")).not.toBeInTheDocument();

        await user.type(field, "Toot");
        await user.click(screen.getByRole("button", { name: "+ Toothache" }));
        expect(screen.getByText("Toothache")).toBeInTheDocument();
    });

    it("handles loading/empty/disabled states for picker and empty state actions", async () => {
        const user = userEvent.setup();
        const onSlotChange = vi.fn();
        const onPrimary = vi.fn();
        const onSecondary = vi.fn();

        render(
            <div>
                <TimeSlotPicker
                    selectedDate="2026-07-09"
                    value=""
                    onChange={onSlotChange}
                    busyKeys={new Set(["2026-07-09|08:00"])}
                    startHour={8}
                    endHour={9}
                    stepMinutes={30}
                />
                <EmptyState
                    title="No rows"
                    description="Nothing to show yet."
                    action={{ label: "Create", onClick: onPrimary }}
                    secondaryAction={{ label: "Dismiss", onClick: onSecondary }}
                />
            </div>,
        );

        expect(screen.getByRole("button", { name: "08:00" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "08:30" }));
        expect(onSlotChange).toHaveBeenCalledWith("08:30");

        await user.click(screen.getByRole("button", { name: "Create" }));
        await user.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(onPrimary).toHaveBeenCalledTimes(1);
        expect(onSecondary).toHaveBeenCalledTimes(1);
    });

    it("handles filter toggles and notice dismissal", async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();

        function FilterHarness() {
            const [value, setValue] = useState<"all" | "open" | "done">("all");
            return (
                <FilterOptionBar
                    ariaLabel="Ticket filter"
                    value={value}
                    onChange={setValue}
                    options={[
                        { value: "all", label: "All" },
                        { value: "open", label: "Open" },
                        { value: "done", label: "Done" },
                    ]}
                />
            );
        }

        render(
            <div>
                <FilterHarness />
                <DismissibleNotice title="Sync warning" dismissKey="notice-sync-warning" onDismiss={onDismiss}>
                    Please retry.
                </DismissibleNotice>
            </div>,
        );

        const doneButton = screen.getByRole("button", { name: "Done" });
        doneButton.focus();
        await user.keyboard("{Enter}");
        expect(doneButton).toHaveAttribute("aria-pressed", "true");

        const notice = screen.getByText("Sync warning").closest(".app-notice");
        expect(notice).not.toBeNull();
        await user.click(within(notice as HTMLElement).getByRole("button", { name: /close/i }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Sync warning")).not.toBeInTheDocument();
        expect(sessionStorage.getItem("medoc-notice-dismiss:notice-sync-warning")).toBe("1");
    });

    it("renders page states and layout primitives", async () => {
        const user = userEvent.setup();
        const onRetry = vi.fn();

        render(
            <div>
                <Card>
                    <CardHeader title="Patient card" subtitle="Detail" action={<Badge variant="success">OK</Badge>} />
                    <FormSection title="Meta">
                        <Spinner />
                        <Skeleton data-testid="skeleton" />
                        <Separator />
                    </FormSection>
                </Card>
                <PageLoading label="Loading patient" />
                <PageLoadError message="Load failed" onRetry={onRetry} />
            </div>,
        );

        expect(screen.getByText("Patient card")).toBeInTheDocument();
        expect(screen.getByText("OK")).toBeInTheDocument();
        expect(screen.getByText("Loading patient").closest('[role="status"]')).not.toBeNull();
        expect(screen.getByTestId("skeleton")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Load failed");

        const retryButton = within(screen.getByRole("alert")).getByRole("button");
        await user.click(retryButton);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
