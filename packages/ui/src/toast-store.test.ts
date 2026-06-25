import { beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "./toast-store";

function resetToastStore() {
    useToastStore.setState({ toasts: [], toastStackPointerInside: false });
}

describe("toast-store policy defaults", () => {
    beforeEach(() => {
        resetToastStore();
    });

    it("uses 3s success and 5s error defaults", () => {
        const add = useToastStore.getState().add;

        add("saved", "success");
        add("failed", "error");

        const toasts = useToastStore.getState().toasts;
        expect(toasts).toHaveLength(2);
        expect(toasts[0].durationMs).toBe(3000);
        expect(toasts[1].durationMs).toBe(5000);
    });

    it("keeps action-required toasts persistent by default", () => {
        const add = useToastStore.getState().add;

        add("undo available", "warning", { onUndo: vi.fn() });

        const [toast] = useToastStore.getState().toasts;
        expect(toast.durationMs).toBe(0);
    });

    it("respects explicit duration override", () => {
        const add = useToastStore.getState().add;

        add("custom", "error", { durationMs: 1234 });

        const [toast] = useToastStore.getState().toasts;
        expect(toast.durationMs).toBe(1234);
    });
});
