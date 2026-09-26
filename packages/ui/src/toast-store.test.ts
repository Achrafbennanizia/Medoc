import { beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "./toast-store";

describe("toast-store policy", () => {
    beforeEach(() => {
        useToastStore.setState({ toasts: [], toastStackPointerInside: false });
    });

    it("uses policy default auto-dismiss durations", () => {
        const add = useToastStore.getState().add;
        add("ok", "success");
        add("warn", "warning");
        add("info", "info");
        add("err", "error");

        const durations = useToastStore
            .getState()
            .toasts.map((toast) => ({ type: toast.type, durationMs: toast.durationMs }));

        expect(durations).toEqual([
            { type: "success", durationMs: 3000 },
            { type: "warning", durationMs: 5000 },
            { type: "info", durationMs: 4000 },
            { type: "error", durationMs: 5000 },
        ]);
    });

    it("supports persistent action-required notices", () => {
        useToastStore
            .getState()
            .add("Manual follow-up required", "error", { persistent: true });

        expect(useToastStore.getState().toasts[0]?.durationMs).toBe(0);
    });
});
