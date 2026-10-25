// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastContainer } from "./toast";
import { useToastStore } from "./toast-store";

function resetStore() {
    useToastStore.setState({
        toasts: [],
        toastStackPointerInside: false,
        setToastStackPointerInside: useToastStore.getState().setToastStackPointerInside,
        add: useToastStore.getState().add,
        remove: useToastStore.getState().remove,
    });
}

describe("ToastContainer", () => {
    beforeEach(() => {
        resetStore();
    });

    afterEach(() => {
        cleanup();
    });

    it("renders nothing for the empty state", () => {
        render(<ToastContainer />);
        expect(
            screen.queryByRole("region", { name: /notifications/i }),
        ).not.toBeInTheDocument();
    });

    it("renders, dismisses, and executes undo callbacks", async () => {
        const user = userEvent.setup();
        const onUndo = vi.fn();
        const store = useToastStore.getState();
        store.add("Saved", "success", { onUndo, undoLabel: "Undo" });

        render(<ToastContainer />);

        expect(screen.getByText("Saved")).toBeVisible();
        await user.click(screen.getByRole("button", { name: "Undo" }));
        expect(onUndo).toHaveBeenCalledTimes(1);

        expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    });

    it("uses alert semantics for error toasts", () => {
        useToastStore.getState().add("Failure", "error");
        render(<ToastContainer />);

        const errorToast = screen.getByRole("alert");
        expect(errorToast).toHaveTextContent("Failure");
    });
});
