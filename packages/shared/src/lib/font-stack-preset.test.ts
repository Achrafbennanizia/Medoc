import { describe, expect, it } from "vitest";
import { FONT_STACK_ORDER, normalizeFontStack } from "./font-stack-preset";
import { fontStackLabelKey, translateLocale } from "./i18n";

describe("font-stack-preset", () => {
    it("exposes Inter, System, and Source Sans", () => {
        expect(FONT_STACK_ORDER).toEqual(["inter", "system", "source-sans"]);
        expect(translateLocale("en", fontStackLabelKey("inter"))).toBe("Inter");
        expect(translateLocale("en", fontStackLabelKey("system"))).toBe("System");
        expect(translateLocale("en", fontStackLabelKey("source-sans"))).toBe("Source Sans");
    });

    it("normalizeFontStack keeps known ids, maps legacy, falls back to inter", () => {
        expect(normalizeFontStack("inter")).toBe("inter");
        expect(normalizeFontStack("system")).toBe("system");
        expect(normalizeFontStack("source-sans")).toBe("source-sans");
        expect(normalizeFontStack("roboto")).toBe("system");
        expect(normalizeFontStack("open-sans")).toBe("source-sans");
        expect(normalizeFontStack("unknown")).toBe("inter");
        expect(normalizeFontStack(undefined)).toBe("inter");
    });
});
