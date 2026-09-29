import { describe, expect, it } from "vitest";
import {
    effectiveArabicNumeralMode,
    normalizeArabicNumeralMode,
    numberingSystemForLocale,
    rewriteDigitsForMode,
} from "./arabic-numerals";

describe("arabic numerals", () => {
    it("defaults unknown values to western", () => {
        expect(normalizeArabicNumeralMode(undefined)).toBe("western");
        expect(normalizeArabicNumeralMode("eastern")).toBe("eastern");
    });

    it("uses stored mode only for Arabic locale", () => {
        expect(effectiveArabicNumeralMode("ar", "eastern")).toBe("eastern");
        expect(effectiveArabicNumeralMode("en", "eastern")).toBe("western");
        expect(effectiveArabicNumeralMode("de", "eastern")).toBe("western");
    });

    it("pins Intl numbering systems", () => {
        expect(numberingSystemForLocale("ar", "eastern")).toBe("arab");
        expect(numberingSystemForLocale("ar", "western")).toBe("latn");
        expect(numberingSystemForLocale("fr", "eastern")).toBe("latn");
    });

    it("rewrites latin and indic digits onto the target system", () => {
        expect(rewriteDigitsForMode("Room 12, €34.50", "eastern")).toBe("Room ١٢, €٣٤.٥٠");
        expect(rewriteDigitsForMode("غرفة ١٢", "western")).toBe("غرفة 12");
        expect(rewriteDigitsForMode("۱۲", "western")).toBe("12");
        expect(rewriteDigitsForMode("١٢", "eastern")).toBe("١٢");
    });

    it("keeps telephone numbers in Western digits", () => {
        expect(rewriteDigitsForMode("Call +49 176 1234567 today", "eastern")).toBe("Call +49 176 1234567 today");
        expect(rewriteDigitsForMode("Room 12 · +49 30 123456", "eastern")).toBe("Room ١٢ · +49 30 123456");
        expect(rewriteDigitsForMode("+٤٩ ١٧٦ ١٢٣٤٥٦٧", "eastern")).toBe("+49 176 1234567");
        expect(rewriteDigitsForMode("0176 1234567", "eastern")).toBe("0176 1234567");
    });
});
