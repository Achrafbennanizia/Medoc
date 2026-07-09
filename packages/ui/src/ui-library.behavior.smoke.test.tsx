/** @vitest-environment jsdom */
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardHeader } from "./card";
import { DismissibleNotice } from "./dismissible-notice";
import { EmptyState } from "./empty-state";
import { FilterOptionBar } from "./filter-option-bar";
import { FormSection } from "./form-section";
import { IconButton } from "./icon-button";
import { Input, Select, Textarea } from "./input";
import { PageLoadError, PageLoading } from "./page-status";
import { Separator } from "./separator";
import { Skeleton } from "./skeleton";
import { Spinner } from "./spinner";
import { TagInput } from "./tag-input";
import { TimeSlotPicker } from "./time-slot-picker";

afterEach(() => {
    cleanup();
});

describe("ui-library behavior", () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it("Button handles click and loading/disabled states", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();

        const { rerender } = render(<Button onClick={onClick}>Save</Button>);
        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(onClick).toHaveBeenCalledTimes(1);

        rerender(
            <Button onClick={onClick} loading>
                Save
            </Button>,
        );
        const loadingButton = screen.getByRole("button", { name: "Save" });
        expect(loadingButton).toBeDisabled();
        expect(loadingButton.querySelector("svg.animate-spin")).not.toBeNull();

        rerender(
            <Button onClick={onClick} disabled>
                Save
            </Button>,
        );
        const disabledButton = screen.getByRole("button", { name: "Save" });
        expect(disabledButton).toBeDisabled();
    });

    it("IconButton exposes label and click behavior", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <IconButton aria-label="close panel" onClick={onClick}>
                <span aria-hidden>×</span>
            </IconButton>,
        );
        await user.click(screen.getByRole("button", { name: "close panel" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("Input, Textarea, and Select react to changes and errors", async () => {
        const user = userEvent.setup();
        const onSelectChange = vi.fn();

        render(
            <div>
                <Input
                    label="Patient name"
                    hint="Full legal name"
                    error="Required"
                    defaultValue=""
                />
                <Textarea label="Notes" error="Too short" defaultValue="" />
                <Select
                    label="Role"
                    options={[
                        { value: "arzt", label: "Arzt" },
                        { value: "rezeption", label: "Rezeption" },
                    ]}
                    defaultValue="arzt"
                    onChange={onSelectChange}
                />
            </div>,
        );

        const input = screen.getByLabelText("Patient name");
        await user.type(input, "Alice");
        expect(input).toHaveValue("Alice");
        expect(screen.getByText("Full legal name")).toBeInTheDocument();
        expect(screen.getByText("Required")).toBeInTheDocument();

        const textarea = screen.getByLabelText("Notes");
        await user.type(textarea, "Follow up required");
        expect(textarea).toHaveValue("Follow up required");
        expect(screen.getByText("Too short")).toBeInTheDocument();

        const trigger = screen.getByRole("button", { name: "Role" });
        await user.click(trigger);
        await user.click(screen.getByRole("option", { name: "Rezeption" }));
        expect(onSelectChange).toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Role" })).toHaveTextContent("Rezeption");
    });

    it("FilterOptionBar only fires change when option actually changes", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <FilterOptionBar
                ariaLabel="status filter"
                value="open"
                options={[
                    { value: "open", label: "Open" },
                    { value: "done", label: "Done" },
                ]}
                onChange={onChange}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Open" }));
        expect(onChange).not.toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: "Done" }));
        expect(onChange).toHaveBeenCalledWith("done");
    });

    it("TimeSlotPicker enforces busy/active slot behavior", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <TimeSlotPicker
                value="08:00"
                selectedDate="2026-07-09"
                busyKeys={new Set(["2026-07-09|08:30"])}
                onChange={onChange}
                startHour={8}
                endHour={9}
                stepMinutes={30}
            />,
        );

        const busySlot = screen.getByRole("button", { name: "08:30" });
        expect(busySlot).toBeDisabled();

        await user.click(screen.getByRole("button", { name: "09:00" }));
        expect(onChange).toHaveBeenCalledWith("09:00");
        expect(screen.getByRole("button", { name: "08:00" })).toHaveAttribute("aria-pressed", "true");
    });

    it("TagInput supports Enter add, suggestion add, and remove", async () => {
        const user = userEvent.setup();
        const Wrapper = () => {
            const [tags, setTags] = useState<string[]>(["acute"]);
            return (
                <TagInput
                    label="Symptoms"
                    value={tags}
                    onChange={setTags}
                    suggestions={["fatigue", "headache"]}
                />
            );
        };

        render(<Wrapper />);

        const input = screen.getByLabelText("Symptoms");
        await user.type(input, "nausea{Enter}");
        expect(screen.getByText("nausea")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "+ fatigue" }));
        expect(screen.getByText("fatigue")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /remove acute/i }));
        expect(screen.queryByText("acute")).not.toBeInTheDocument();
    });

    it("DismissibleNotice supports close and remembers dismissKey in session", async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        const { rerender } = render(
            <DismissibleNotice
                title="Heads up"
                subtitle="Action required"
                dismissKey="notice-a"
                onDismiss={onDismiss}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Close" }));
        expect(onDismiss).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Heads up")).not.toBeInTheDocument();

        rerender(
            <DismissibleNotice
                title="Heads up"
                subtitle="Action required"
                dismissKey="notice-a"
            />,
        );
        expect(screen.queryByText("Heads up")).not.toBeInTheDocument();
    });

    it("EmptyState action buttons and static primitives render expected semantics", async () => {
        const user = userEvent.setup();
        const primary = vi.fn();
        const secondary = vi.fn();
        const retry = vi.fn();

        render(
            <div>
                <Card elevated className="qa-card">
                    <CardHeader title="Inbox" subtitle="Overview" action={<button type="button">Go</button>} />
                </Card>
                <FormSection title="Patient details">
                    <Input label="Email" defaultValue="a@b.c" />
                </FormSection>
                <Badge variant="warning">pending</Badge>
                <Separator data-testid="sep" />
                <Skeleton data-testid="skeleton" />
                <Spinner size="lg" data-testid="spinner" />
                <PageLoading label="Loading records" />
                <PageLoadError message="Network failed" onRetry={retry} />
                <EmptyState
                    title="No results"
                    description="Adjust your filter"
                    action={{ label: "Create", onClick: primary }}
                    secondaryAction={{ label: "Dismiss", onClick: secondary }}
                />
            </div>,
        );

        expect(screen.getByText("Inbox")).toBeInTheDocument();
        expect(screen.getByText("Overview")).toBeInTheDocument();
        expect(screen.getByText("pending")).toBeInTheDocument();
        expect(screen.getByTestId("sep")).toHaveAttribute("role", "separator");
        expect(screen.getByTestId("skeleton")).toHaveAttribute("aria-hidden");
        expect(screen.getByTestId("spinner")).toHaveAttribute("role", "status");
        expect(screen.getByText("Loading records")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Network failed");

        await user.click(screen.getByRole("button", { name: "Try again" }));
        expect(retry).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole("button", { name: "Create" }));
        await user.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(primary).toHaveBeenCalledTimes(1);
        expect(secondary).toHaveBeenCalledTimes(1);
    });

    it("Select closes on Escape and outside click (dismissible layer)", async () => {
        const user = userEvent.setup();
        render(
            <div>
                <Select
                    label="Department"
                    options={[
                        { value: "a", label: "A" },
                        { value: "b", label: "B" },
                    ]}
                    defaultValue="a"
                />
                <button type="button">Outside</button>
            </div>,
        );

        await user.click(screen.getByRole("button", { name: "Department" }));
        expect(screen.getByRole("option", { name: "B" })).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("option", { name: "B" })).not.toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: "Department" }));
        expect(screen.getByRole("option", { name: "B" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Outside" }));
        expect(screen.queryByRole("option", { name: "B" })).not.toBeInTheDocument();
    });

    it("FormSection keeps heading hierarchy and field grouping", () => {
        render(
            <FormSection title="Clinical data">
                <Textarea label="Summary" defaultValue="ok" />
            </FormSection>,
        );
        expect(screen.getByText("Clinical data")).toBeInTheDocument();
        expect(screen.getByLabelText("Summary")).toBeInTheDocument();
    });
});
