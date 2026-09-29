/**
 * Standard Arabic Gregorian (milādī) month names: يناير–ديسمبر.
 * Forced so the UI never uses Hijri or Levantine (كانون/شباط) month names.
 */
import { arSA } from "date-fns/locale/ar-SA";
import type { Locale } from "date-fns";

export const AR_GREGORIAN_MONTHS_WIDE = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
] as const;

export const AR_GREGORIAN_MONTHS_ABBR = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
] as const;

const AR_GREGORIAN_MONTHS_NARROW = ["ي", "ف", "م", "أ", "م", "ي", "ي", "أ", "س", "أ", "ن", "د"] as const;

export const dateFnsArGregorian: Locale = {
    ...arSA,
    code: "ar",
    localize: {
        ...arSA.localize,
        month: (n, options) => {
            const width = options?.width ?? "wide";
            if (width === "narrow") return AR_GREGORIAN_MONTHS_NARROW[n] ?? "";
            if (width === "abbreviated") return AR_GREGORIAN_MONTHS_ABBR[n] ?? "";
            return AR_GREGORIAN_MONTHS_WIDE[n] ?? "";
        },
    },
};
