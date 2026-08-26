import { beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "./toast-store";

function resetToasts() {
    useToastStore.setState({
        toasts: [],
        toastStackPointerInside: false,
    });
}

describe("toast-store compliance defaults", () => {
    beforeEach(() => {
        resetToasts();
    });

    it("uses 3 seconds for success toasts", () => {
        useToastStore.getState().add("Saved", "success");
        const toast = useToastStore.getState().toasts[0];
        expect(toast.durationMs).toBe(3000);
    });

    it("uses 5 seconds for error toasts", () => {
        useToastStore.getState().add("Failed", "error");
        const toast = useToastStore.getState().toasts[0];
        expect(toast.durationMs).toBe(5000);
    });

    it("keeps action-required toasts persistent until dismissed", () => {
        useToastStore.getState().add("Action required", "error", {
            requiresAction: true,
        });
        const toast = useToastStore.getState().toasts[0];
        expect(toast.durationMs).toBe(Number.POSITIVE_INFINITY);
    });
});
