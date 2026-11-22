import { describe, expect, it, vi } from "vitest";
import { createListenerSet } from "./create-listener-set";

describe("createListenerSet", () => {
    it("notifies subscribers until they unsubscribe", () => {
        const set = createListenerSet();
        const fn = vi.fn();
        const off = set.subscribe(fn);
        set.notify();
        off();
        set.notify();
        expect(fn).toHaveBeenCalledTimes(1);
    });
});
