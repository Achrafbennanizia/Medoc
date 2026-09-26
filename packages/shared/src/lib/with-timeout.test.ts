import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./with-timeout";

describe("withTimeout", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("resolves when promise completes before timeout", async () => {
        await expect(withTimeout(Promise.resolve("ok"), 50, "test")).resolves.toBe("ok");
    });

    it("rejects when timeout is reached first", async () => {
        vi.useFakeTimers();
        const pending = new Promise<never>(() => {});
        const timed = withTimeout(pending, 100, "slow check");
        const assertion = expect(timed).rejects.toThrow("slow check timed out after 100ms");

        await vi.advanceTimersByTimeAsync(100);
        await assertion;
    });
});
