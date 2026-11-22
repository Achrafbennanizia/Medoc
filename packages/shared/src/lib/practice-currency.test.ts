import { afterEach, describe, expect, it } from "vitest";
import {
    normalizePracticeCurrency,
    practiceCurrency,
    publishPracticeCurrency,
    subscribePracticeCurrency,
} from "./practice-currency";

const PRACTICE_STORAGE_KEY = "medoc-invoice-practice-v1";

describe("practice-currency", () => {
    afterEach(() => {
        try {
            localStorage.removeItem(PRACTICE_STORAGE_KEY);
        } catch {
            /* ignore */
        }
    });

    it("defaults to EUR", () => {
        expect(practiceCurrency()).toBe("EUR");
    });

    it("reads currency from the practice profile cache", () => {
        localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify({ currency: "MAD" }));
        expect(practiceCurrency()).toBe("MAD");
    });

    it("normalizes unknown codes to EUR", () => {
        expect(normalizePracticeCurrency("mad")).toBe("MAD");
        expect(normalizePracticeCurrency("XYZ")).toBe("EUR");
    });

    it("notifies subscribers on publish", () => {
        let hits = 0;
        const unsub = subscribePracticeCurrency(() => {
            hits += 1;
        });
        publishPracticeCurrency();
        expect(hits).toBe(1);
        unsub();
        publishPracticeCurrency();
        expect(hits).toBe(1);
    });
});
