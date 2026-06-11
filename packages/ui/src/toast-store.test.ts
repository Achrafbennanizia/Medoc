import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useToastStore } from "./toast-store";

let idCounter = 0;

function resetToastState() {
    useToastStore.setState({
        toasts: [],
        toastStackPointerInside: false,
    });
}

describe("toast-store", () => {
    beforeEach(() => {
        idCounter = 0;
        vi.stubGlobal("crypto", {
            randomUUID: () => `toast-${++idCounter}`,
        });
        resetToastState();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        resetToastState();
    });

    it("uses required default success and error durations", () => {
        const store = useToastStore.getState();
        store.add("ok", "success");
        store.add("oops", "error");
        const [success, error] = useToastStore.getState().toasts;
        expect(success.durationMs).toBe(3000);
        expect(error.durationMs).toBe(5000);
    });

    it("supports persistent action-required toasts", () => {
        const store = useToastStore.getState();
        store.add("needs confirmation", "warning", { persistent: true });
        const [toast] = useToastStore.getState().toasts;
        expect(toast.durationMs).toBe(0);
    });
});
