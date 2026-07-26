import { act } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    Button,
    ConfirmDialog,
    EmptyState,
    IconButton,
    Input,
    PageLoading,
    ToastContainer,
    useToastStore,
} from "@/views/components/ui";

function resetToastStore() {
    useToastStore.setState((state) => ({
        ...state,
        toasts: [],
        toastStackPointerInside: false,
    }));
}

describe("UI event matrix", () => {
    afterEach(() => {
        cleanup();
        resetToastStore();
        vi.useRealTimers();
    });

    it("handles button click, disabled, and keyboard activation", async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();
        render(
            <>
                <Button onClick={onClick}>Primary</Button>
                <Button onClick={onClick} disabled>
                    Disabled
                </Button>
            </>,
        );

        await user.click(screen.getByRole("button", { name: "Primary" }));
        expect(onClick).toHaveBeenCalledTimes(1);

        screen.getByRole("button", { name: "Primary" }).focus();
        await user.keyboard("{Enter}");
        expect(onClick).toHaveBeenCalledTimes(2);

        await user.click(screen.getByRole("button", { name: "Disabled" }));
        expect(onClick).toHaveBeenCalledTimes(2);
    });

    it("handles input change and exposes error state semantics", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <Input
                label="Email"
                hint="Use your work email."
                error="Required field."
                value=""
                onChange={onChange}
            />,
        );

        const field = screen.getByLabelText("Email");
        await user.type(field, "a");
        expect(onChange).toHaveBeenCalled();
        expect(field).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByText("Required field.")).toBeInTheDocument();
        expect(screen.getByText("Use your work email.")).toBeInTheDocument();
    });

    it("renders loading and empty states with actions", async () => {
        const onPrimary = vi.fn();
        const onSecondary = vi.fn();
        const user = userEvent.setup();

        render(
            <>
                <PageLoading label="Loading data" />
                <EmptyState
                    title="No records"
                    description="Create one to continue."
                    action={{ label: "Create", onClick: onPrimary }}
                    secondaryAction={{ label: "Dismiss", onClick: onSecondary }}
                />
            </>,
        );

        expect(screen.getByRole("status", { name: "" })).toHaveAttribute("aria-busy", "true");
        await user.click(screen.getByRole("button", { name: "Create" }));
        await user.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(onPrimary).toHaveBeenCalledTimes(1);
        expect(onSecondary).toHaveBeenCalledTimes(1);
    });

    it("supports dialog keyboard behaviors (Escape, Tab trap, Enter confirm)", async () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn();
        const user = userEvent.setup();

        render(
            <ConfirmDialog
                open
                title="Confirm delete"
                message="This action cannot be undone."
                onClose={onClose}
                onConfirm={onConfirm}
                confirmLabel="Delete"
                cancelLabel="Cancel"
            />,
        );

        await user.tab();
        const cancel = screen.getByRole("button", { name: "Cancel" });
        const confirm = screen.getByRole("button", { name: "Delete" });
        expect(cancel).toHaveFocus();

        await user.tab();
        expect(confirm).toHaveFocus();
        await user.tab();
        expect(cancel).toHaveFocus();

        confirm.focus();
        await user.keyboard("{Enter}");
        expect(onConfirm).toHaveBeenCalledTimes(1);

        await user.keyboard("{Escape}");
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("requires labeled icon controls and keeps action-required toast persistent", async () => {
        vi.useFakeTimers();
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const dismiss = vi.fn();

        render(
            <>
                <IconButton aria-label="Close panel" onClick={dismiss}>
                    ×
                </IconButton>
                <ToastContainer />
            </>,
        );

        await user.click(screen.getByRole("button", { name: "Close panel" }));
        expect(dismiss).toHaveBeenCalledTimes(1);

        useToastStore.getState().add("Action required", "warning", { durationMs: 0 });
        expect(useToastStore.getState().toasts.at(-1)?.durationMs).toBe(0);

        act(() => {
            vi.advanceTimersByTime(30_000);
        });
        expect(screen.getByText("Action required")).toBeInTheDocument();
    });

    it("uses policy toast durations for success and error", () => {
        resetToastStore();
        useToastStore.getState().add("Success", "success");
        useToastStore.getState().add("Error", "error");
        const [ok, err] = useToastStore.getState().toasts;
        expect(ok.durationMs).toBe(3000);
        expect(err.durationMs).toBe(5000);
    });
});
