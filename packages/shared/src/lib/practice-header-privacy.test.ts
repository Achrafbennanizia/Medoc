import { describe, expect, it } from "vitest";
import {
    DEFAULT_PRACTICE_HEADER_PRIVACY,
    parsePracticeHeaderPrivacyJson,
} from "./practice-header-privacy";

describe("parsePracticeHeaderPrivacyJson", () => {
    it("reads English tax/hours/vat keys only", () => {
        const p = parsePracticeHeaderPrivacyJson({
            tel: true,
            tax: false,
            hours: false,
            vat: false,
            steuer: true,
            oz: true,
            ust: true,
        });
        expect(p.tax).toBe(false);
        expect(p.hours).toBe(false);
        expect(p.vat).toBe(false);
        expect(p.tel).toBe(true);
        expect(p.kv).toBe(DEFAULT_PRACTICE_HEADER_PRIVACY.kv);
    });

    it("ignores leftover German keys when English absent", () => {
        const p = parsePracticeHeaderPrivacyJson({ steuer: false, oz: false, ust: false });
        expect(p.tax).toBe(DEFAULT_PRACTICE_HEADER_PRIVACY.tax);
        expect(p.hours).toBe(DEFAULT_PRACTICE_HEADER_PRIVACY.hours);
        expect(p.vat).toBe(DEFAULT_PRACTICE_HEADER_PRIVACY.vat);
    });

    it("default privacy object has English keys only", () => {
        const keys = Object.keys(DEFAULT_PRACTICE_HEADER_PRIVACY);
        expect(keys).toContain("tax");
        expect(keys).toContain("hours");
        expect(keys).toContain("vat");
        expect(keys).not.toContain("steuer");
        expect(keys).not.toContain("oz");
        expect(keys).not.toContain("ust");
        const raw = JSON.parse(JSON.stringify(DEFAULT_PRACTICE_HEADER_PRIVACY)) as Record<string, unknown>;
        expect(raw.steuer).toBeUndefined();
        expect(raw.oz).toBeUndefined();
        expect(raw.ust).toBeUndefined();
    });
});
