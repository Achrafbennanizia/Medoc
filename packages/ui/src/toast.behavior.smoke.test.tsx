/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastContainer } from "./toast";
import { useToastStore } from "./toast-store";

function resetToastStore() {
    useToastStore.setState({
        toasts: [],
        toastStackPointerInside: false,
    });
}

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});

describe("toast policy and behavior", () => {
    beforeEach(() => {
        resetToastStore();
    });

    it("uses required default durations for success/error/warning/info", () => {
        const add = useToastStore.getState().add;
        add("ok", "success");
        add("problem", "error");
        add("warn", "warning");
        add("note", "info");

        const toasts = useToastStore.getState().toasts;
        expect(toasts[0].durationMs).toBe(3000);
        expect(toasts[1].durationMs).toBe(5000);
        expect(toasts[2].durationMs).toBe(5000);
        expect(toasts[3].durationMs).toBe(4000);
    });

    it("renders dismissable rows and supports undo callbacks", async () => {
        const user = userEvent.setup();
        const undo = vi.fn();
        useToastStore.getState().add("Saved", "success", { onUndo: undo, undoLabel: "Undo change" });
        useToastStore.getState().add("Failed", "error");

        render(<ToastContainer />);
        expect(screen.getByRole("status")).toHaveTextContent("Saved");
        expect(screen.getByRole("alert")).toHaveTextContent("Failed");

        await user.click(screen.getByRole("button", { name: "Undo change" }));
        expect(undo).toHaveBeenCalledTimes(1);
    });

    it("auto-dismisses success toasts after the timeout window", () => {
        vi.useFakeTimers();
        useToastStore.getState().add("Saved", "success");
        render(<ToastContainer />);

        vi.advanceTimersByTime(3600);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("pauses dismiss while pointer is inside the row", () => {
        vi.useFakeTimers();
        useToastStore.getState().add("Saved", "success");
        render(<ToastContainer />);

        const row = screen.getByRole("status");
        fireEvent.pointerEnter(row);
        vi.advanceTimersByTime(7000);
        expect(screen.getByRole("status")).toBeInTheDocument();

        fireEvent.pointerLeave(row);
        vi.advanceTimersByTime(3600);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
});
