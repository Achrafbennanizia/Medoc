import { beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "./toast-store";

describe("toast defaults", () => {
    beforeEach(() => {
        useToastStore.setState((s) => ({
            ...s,
            toasts: [],
            toastStackPointerInside: false,
        }));
    });

    it("uses 3s success and 5s error defaults", () => {
        const { add } = useToastStore.getState();
        add("saved", "success");
        add("failed", "error");
        const [successToast, errorToast] = useToastStore.getState().toasts;
        expect(successToast.durationMs).toBe(3000);
        expect(errorToast.durationMs).toBe(5000);
    });
});
