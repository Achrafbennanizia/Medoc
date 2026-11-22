import { describe, expect, it } from "vitest";
import { formatLockoutCountdown, rateLimitSeconds } from "./login-lockout";

describe("sign-in lockout countdown", () => {
    it("reads the remaining seconds from a coded lockout error", () => {
        expect(rateLimitSeconds("error.app.rate_limited|seconds=900")).toBe(900);
        expect(rateLimitSeconds(new Error("IPC error — error.app.rate_limited|seconds=12"))).toBe(12);
        expect(rateLimitSeconds("error.app.unauthorized")).toBeNull();
        expect(rateLimitSeconds("error.app.rate_limited|seconds=0")).toBeNull();
    });

    it("formats the wait until the next attempt", () => {
        expect(formatLockoutCountdown(900)).toBe("15:00");
        expect(formatLockoutCountdown(65)).toBe("1:05");
        expect(formatLockoutCountdown(5)).toBe("0:05");
        expect(formatLockoutCountdown(3661)).toBe("1:01:01");
    });
});
