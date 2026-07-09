import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardHeader } from "./card";
import { DismissibleNotice } from "./dismissible-notice";
import { EmptyState } from "./empty-state";
import { FilterOptionBar } from "./filter-option-bar";
import { FormSection } from "./form-section";
import { IconButton } from "./icon-button";
import { Input, Select, Textarea } from "./input";
import { Skeleton } from "./skeleton";
import { Spinner } from "./spinner";
import { TagInput } from "./tag-input";
import { TimeSlotPicker } from "./time-slot-picker";

describe("ui components behavior", () => {
    afterEach(() => {
        cleanup();
    });

    it("handles click, loading and disabled states on buttons", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        render(
            <div>
                <Button onClick={onClick}>Save</Button>
                <Button loading>Saving</Button>
            </div>,
        );

        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(onClick).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();
    });

    it("supports input, select and textarea changes", async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        render(
            <div>
                <Input id="name" label="Name" defaultValue="" />
                <Select
                    id="mode"
                    label="Mode"
                    defaultValue="a"
                    options={[
                        { value: "a", label: "Alpha" },
                        { value: "b", label: "Beta" },
                    ]}
                    onChange={onSelect}
                />
                <Textarea id="notes" label="Notes" defaultValue="" />
            </div>,
        );

        await user.type(screen.getByLabelText("Name"), "Jane");
        expect(screen.getByLabelText("Name")).toHaveValue("Jane");

        await user.click(screen.getByRole("button", { name: "Mode" }));
        await user.click(await screen.findByRole("option", { name: "Beta" }));
        expect(onSelect).toHaveBeenCalled();

        await user.type(screen.getByLabelText("Notes"), "text");
        expect(screen.getByLabelText("Notes")).toHaveValue("text");
    });

    it("runs icon button and empty state actions", async () => {
        const user = userEvent.setup();
        const onIconClick = vi.fn();
        const onPrimary = vi.fn();
        const onSecondary = vi.fn();
        render(
            <div>
                <IconButton aria-label="Open info" onClick={onIconClick}>
                    i
                </IconButton>
                <EmptyState
                    title="No data"
                    description="Try creating one."
                    action={{ label: "Create", onClick: onPrimary }}
                    secondaryAction={{ label: "Dismiss", onClick: onSecondary }}
                />
            </div>,
        );

        await user.click(screen.getByRole("button", { name: "Open info" }));
        await user.click(screen.getByRole("button", { name: "Create" }));
        await user.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(onIconClick).toHaveBeenCalledTimes(1);
        expect(onPrimary).toHaveBeenCalledTimes(1);
        expect(onSecondary).toHaveBeenCalledTimes(1);
    });

    it("supports tag add/remove and option bar changes", async () => {
        const user = userEvent.setup();
        const onMode = vi.fn();
        const onTags = vi.fn();
        render(
            <div>
                <TagInput
                    label="Tags"
                    value={["urgent"]}
                    suggestions={["follow-up"]}
                    onChange={onTags}
                />
                <FilterOptionBar
                    ariaLabel="Mode"
                    value="start"
                    options={[
                        { value: "start", label: "Start" },
                        { value: "done", label: "Done" },
                    ]}
                    onChange={onMode}
                />
            </div>,
        );

        await user.type(screen.getByLabelText("Tags"), "billing{Enter}");
        expect(onTags).toHaveBeenCalledWith(["urgent", "billing"]);

        await user.click(screen.getByRole("button", { name: "Done" }));
        expect(onMode).toHaveBeenCalledWith("done");
    });

    it("supports keyboard and disabled states in time slot picker", async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <TimeSlotPicker
                value="08:00"
                onChange={onChange}
                selectedDate="2026-07-09"
                busyKeys={new Set(["2026-07-09|08:30"])}
                startHour={8}
                endHour={9}
                stepMinutes={30}
            />,
        );

        const busyButton = screen.getByRole("button", { name: "08:30" });
        const freeButton = screen.getByRole("button", { name: "09:00" });
        expect(busyButton).toBeDisabled();
        await user.click(freeButton);
        expect(onChange).toHaveBeenCalledWith("09:00");
    });

    it("dismisses notice and remembers dismiss key", async () => {
        const user = userEvent.setup();
        const onDismiss = vi.fn();
        sessionStorage.clear();

        const { rerender } = render(
            <DismissibleNotice
                title="Heads up"
                subtitle="Notice body"
                dismissKey="notice-key"
                onDismiss={onDismiss}
            />,
        );
        await user.click(screen.getByRole("button", { name: "Close" }));
        expect(onDismiss).toHaveBeenCalledTimes(1);

        rerender(
            <DismissibleNotice
                title="Heads up"
                subtitle="Notice body"
                dismissKey="notice-key"
                onDismiss={onDismiss}
            />,
        );
        expect(screen.queryByText("Heads up")).toBeNull();
    });

    it("renders structural components and loading placeholders", () => {
        render(
            <div>
                <Card>
                    <CardHeader title="Header" subtitle="Subtitle" />
                    <FormSection title="Details">Body</FormSection>
                </Card>
                <Badge>State</Badge>
                <Spinner data-testid="spinner" />
                <Skeleton data-testid="skeleton" />
            </div>,
        );

        expect(screen.getByText("Header")).toBeInTheDocument();
        expect(screen.getByText("Details")).toBeInTheDocument();
        expect(screen.getByText("State")).toBeInTheDocument();
        expect(screen.getByTestId("spinner")).toBeInTheDocument();
        expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    });
});
