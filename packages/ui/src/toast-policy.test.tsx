// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ToastContainer } from "./toast";
import { useToastStore } from "./toast-store";

function resetToasts() {
    useToastStore.setState({
        toasts: [],
        toastStackPointerInside: false,
    });
}

describe("toast policy", () => {
    afterEach(() => {
        cleanup();
        resetToasts();
        vi.useRealTimers();
    });

    it("uses 3s success and 5s error defaults", () => {
        const add = useToastStore.getState().add;
        add("Saved", "success");
        add("Failed", "error");
        const [success, error] = useToastStore.getState().toasts;
        expect(success?.durationMs).toBe(3000);
        expect(error?.durationMs).toBe(5000);
    });

    it("keeps action-required toasts persistent until dismissed", () => {
        vi.useFakeTimers();
        const undo = vi.fn();
        useToastStore.getState().add("Action required", "warning", { onUndo: undo });
        const toast = useToastStore.getState().toasts[0];
        expect(toast?.durationMs).toBe(0);
        render(<ToastContainer />);

        expect(screen.getByText("Action required")).toBeInTheDocument();
        vi.advanceTimersByTime(15_000);
        expect(screen.getByText("Action required")).toBeInTheDocument();
    });
});
