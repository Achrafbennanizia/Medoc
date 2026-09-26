// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { EmptyState } from "./empty-state";
import { FilterOptionBar } from "./filter-option-bar";
import { Input } from "./input";
import { PageLoadError } from "./page-status";
import { TagInput } from "./tag-input";

describe("ui event matrix", () => {
    afterEach(() => {
        cleanup();
    });

    it("handles click, disabled, and loading states for primary actions", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();
        const { rerender } = render(<Button onClick={onClick}>Save</Button>);

        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(onClick).toHaveBeenCalledTimes(1);

        rerender(
            <Button onClick={onClick} disabled>
                Save
            </Button>,
        );
        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(onClick).toHaveBeenCalledTimes(1);

        rerender(
            <Button onClick={onClick} loading>
                Save
            </Button>,
        );
        expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("supports input/change + submit + keyboard tab/enter", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
        const onChange = vi.fn();

        render(
            <form onSubmit={onSubmit}>
                <Input label="Email" value="" onChange={onChange} />
                <Input label="Password" type="password" value="" onChange={() => {}} />
                <Button type="submit">Sign in</Button>
            </form>,
        );

        const email = screen.getByLabelText("Email");
        await user.type(email, "hello@example.com");
        expect(onChange).toHaveBeenCalled();

        await user.tab();
        expect(screen.getByLabelText("Password")).toHaveFocus();

        await user.keyboard("{Enter}");
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("renders error + empty states and dispatches their handlers", async () => {
        const user = userEvent.setup();
        const onRetry = vi.fn();
        const onEmptyAction = vi.fn();

        render(
            <>
                <PageLoadError message="Could not load" onRetry={onRetry} />
                <EmptyState
                    title="No rows"
                    description="Try adding one."
                    action={{ label: "Create", onClick: onEmptyAction }}
                />
            </>,
        );

        expect(screen.getByRole("alert")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        await user.click(screen.getByRole("button", { name: "Create" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onEmptyAction).toHaveBeenCalledTimes(1);
    });

    it("supports keyboard enter/remove for tag input and click for option bar", async () => {
        const user = userEvent.setup();
        const setTags = vi.fn();
        const onFilterChange = vi.fn();

        render(
            <>
                <TagInput
                    label="Complaints"
                    value={["Toothache"]}
                    onChange={setTags}
                    suggestions={["Headache"]}
                />
                <FilterOptionBar
                    ariaLabel="Status"
                    value="all"
                    options={[
                        { value: "all", label: "All" },
                        { value: "open", label: "Open" },
                    ]}
                    onChange={onFilterChange}
                />
            </>,
        );

        const input = screen.getByLabelText("Complaints");
        await user.type(input, "Swelling{Enter}");
        expect(setTags).toHaveBeenCalled();

        await user.click(screen.getByRole("button", { name: /toothache/i }));
        expect(setTags).toHaveBeenCalledTimes(2);

        await user.click(screen.getByRole("button", { name: "Open" }));
        expect(onFilterChange).toHaveBeenCalledWith("open");
    });

    it("closes dialogs with Escape key", () => {
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose} title="Confirm action">
                <p>Body</p>
            </Dialog>,
        );

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
