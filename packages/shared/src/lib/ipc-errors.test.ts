import { describe, expect, it } from "vitest";
import { formatIpcError } from "./ipc-errors";

describe("formatIpcError", () => {
    it("translates error.app.unauthorized in all locales", () => {
        expect(formatIpcError("error.app.unauthorized", "en")).toBe("Not authorized.");
        expect(formatIpcError("error.app.unauthorized", "de")).toBe("Nicht autorisiert.");
        expect(formatIpcError("error.app.unauthorized", "fr")).toBe("Non autorisé.");
        expect(formatIpcError("error.app.unauthorized", "ar")).toBe("غير مصرح.");
    });

    it("translates coded rate-limit with params", () => {
        expect(formatIpcError("error.app.rate_limited|seconds=30", "en")).toContain("30");
        expect(formatIpcError("error.app.rate_limited|seconds=30", "de")).toContain("30");
        expect(formatIpcError("error.app.rate_limited|seconds=30", "fr")).toContain("30");
        expect(formatIpcError("error.app.rate_limited|seconds=30", "ar")).toContain("30");
    });

    it("translates Error.message that is an i18n key", () => {
        expect(formatIpcError(new Error("error.app.forbidden"), "en")).toBe("Access denied.");
        expect(formatIpcError(new Error("error.app.forbidden"), "de")).toBe("Zugriff verweigert.");
        expect(formatIpcError(new Error("error.app.forbidden"), "fr")).toBe("Accès refusé.");
        expect(formatIpcError(new Error("error.app.forbidden"), "ar")).toBe("تم رفض الوصول.");
    });

    it("extracts coded keys from wrapped messages", () => {
        expect(formatIpcError("invoke failed: error.app.unauthorized", "en")).toBe("Not authorized.");
        expect(formatIpcError("IPC error — error.app.rate_limited|seconds=12", "de")).toContain("12");
    });
});
