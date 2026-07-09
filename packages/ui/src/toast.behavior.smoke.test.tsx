import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastContainer } from "./toast";
import { useToastStore } from "./toast-store";

describe("toast behavior", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useToastStore.setState({ toasts: [], toastStackPointerInside: false });
    });

    afterEach(() => {
        vi.useRealTimers();
        useToastStore.setState({ toasts: [], toastStackPointerInside: false });
        cleanup();
    });

    it("auto-dismisses success in ~3s and error in ~5s", () => {
        render(<ToastContainer />);
        act(() => {
            useToastStore.getState().add("Saved", "success");
        });
        expect(screen.getByText("Saved")).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(3600);
        });
        expect(screen.queryByText("Saved")).toBeNull();

        act(() => {
            useToastStore.getState().add("Failed", "error");
        });
        expect(screen.getByText("Failed")).toBeInTheDocument();
        act(() => {
            vi.advanceTimersByTime(5600);
        });
        expect(screen.queryByText("Failed")).toBeNull();
    });

    it("keeps action-required toast persistent", () => {
        render(<ToastContainer />);
        act(() => {
            useToastStore
                .getState()
                .add("Action required", "warning", { persistent: true });
        });

        expect(screen.getByText("Action required")).toBeInTheDocument();
        act(() => {
            vi.advanceTimersByTime(20_000);
        });
        expect(screen.getByText("Action required")).toBeInTheDocument();
    });
});
