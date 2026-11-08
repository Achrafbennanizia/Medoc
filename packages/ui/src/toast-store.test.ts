import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    ACTIVITY_UNDO_MS,
    TOAST_REPEAT_GAP_MS,
    TOAST_REPEAT_MAX,
    TOAST_REPEAT_WINDOW_MS,
    recordToastStamp,
    useToastStore,
} from "./toast-store";

describe("recordToastStamp", () => {
    const start = 1_700_000_000_000;

    it("allows the same notification every 3 minutes, up to 3 times", () => {
        let stamps: number[] = [];
        for (let i = 0; i < TOAST_REPEAT_MAX; i += 1) {
            const decision = recordToastStamp(stamps, start + i * TOAST_REPEAT_GAP_MS);
            expect(decision.allow).toBe(true);
            stamps = decision.next;
        }
        expect(stamps).toHaveLength(3);
    });

    it("blocks a repeat before 3 minutes have passed", () => {
        const first = recordToastStamp([], start);
        const early = recordToastStamp(first.next, start + TOAST_REPEAT_GAP_MS - 1);
        expect(early.allow).toBe(false);
        expect(early.next).toEqual(first.next);
    });

    it("holds the same notification for 1 hour after the third show", () => {
        let stamps: number[] = [];
        for (let i = 0; i < TOAST_REPEAT_MAX; i += 1) {
            stamps = recordToastStamp(stamps, start + i * TOAST_REPEAT_GAP_MS).next;
        }
        const third = start + (TOAST_REPEAT_MAX - 1) * TOAST_REPEAT_GAP_MS;
        const blocked = recordToastStamp(stamps, third + TOAST_REPEAT_WINDOW_MS - 1);
        expect(blocked.allow).toBe(false);
        const again = recordToastStamp(stamps, third + TOAST_REPEAT_WINDOW_MS);
        expect(again.allow).toBe(true);
        expect(again.next).toEqual([third + TOAST_REPEAT_WINDOW_MS]);
    });
});

describe("activity toasts", () => {
    beforeEach(() => {
        localStorage.clear();
        useToastStore.setState({ toasts: [], toastStackPointerInside: false });
    });

    it("keeps showing an undoable confirmation even when the same message repeats", () => {
        const undo = vi.fn();
        useToastStore.getState().add("Patient saved", "success", { onUndo: undo });
        useToastStore.getState().add("Patient saved", "success", { onUndo: undo });
        const toasts = useToastStore.getState().toasts;
        expect(toasts).toHaveLength(2);
        expect(toasts[0]?.durationMs).toBe(ACTIVITY_UNDO_MS);
        expect(toasts[0]?.undoLabel).toBe("Undo");
    });

    it("still rate-limits a confirmation that cannot be undone", () => {
        useToastStore.getState().add("Copied", "success");
        useToastStore.getState().add("Copied", "success");
        expect(useToastStore.getState().toasts).toHaveLength(1);
    });
});
