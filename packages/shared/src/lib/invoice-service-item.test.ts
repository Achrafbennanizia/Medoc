import { afterEach, describe, expect, it, vi } from "vitest";

const getAppKv = vi.fn();
const setAppKv = vi.fn();

vi.mock("@/systems/practice-host/controllers/app-kv.controller", () => ({
    getAppKv: (...args: unknown[]) => getAppKv(...args),
    setAppKv: (...args: unknown[]) => setAppKv(...args),
}));

import {
    buildInvoiceHeaderAddressLines,
    getInvoicePracticeFromStorage,
    hydrateInvoicePracticeFromAppKv,
    parseInvoicePracticeJson,
    saveInvoicePracticeToStorage,
    type InvoicePractice,
} from "./invoice-service-item";
import { practiceCurrency } from "./practice-currency";
import { DEFAULT_PRACTICE_HEADER_PRIVACY } from "./practice-header-privacy";

const PRACTICE_LS = "medoc-invoice-practice-v1";

const practice: InvoicePractice = {
    name: "Clinic",
    addr: "Street 1",
    kv_number: "123456",
    tax_number: "DE-TAX",
    opening_hours: "Mon–Fri 08:00–18:00",
    chamber: "Berlin",
};

afterEach(() => {
    getAppKv.mockReset();
    setAppKv.mockReset();
    try {
        localStorage.removeItem(PRACTICE_LS);
    } catch {
        /* ignore */
    }
});

describe("buildInvoiceHeaderAddressLines", () => {
    it("labels KV as health insurance, not site number", () => {
        const lines = buildInvoiceHeaderAddressLines(practice, DEFAULT_PRACTICE_HEADER_PRIVACY);
        expect(lines).toContain("Health insurance no. 123456");
        expect(lines.some((l) => /site no/i.test(l))).toBe(false);
        expect(lines.some((l) => /Betriebs/i.test(l))).toBe(false);
    });
});

describe("parseInvoicePracticeJson", () => {
    it("reads English chamber and vat_id keys only", () => {
        const english = parseInvoicePracticeJson({
            name: "Clinic",
            addr: "Street",
            chamber: "Berlin",
            vat_id: "DE2",
            kammer: "Hamburg",
            ust_id: "DE1",
        });
        expect(english.chamber).toBe("Berlin");
        expect(english.vat_id).toBe("DE2");
    });

    it("ignores leftover German keys", () => {
        const leftover = parseInvoicePracticeJson({
            name: "Clinic",
            addr: "Street",
            kammer: "Hamburg",
            ust_id: "DE1",
        });
        expect(leftover.chamber).toBeUndefined();
        expect(leftover.vat_id).toBeUndefined();
    });
});

describe("hydrateInvoicePracticeFromAppKv currency race", () => {
    it("does not clobber a currency saved while app_kv is still loading", async () => {
        setAppKv.mockResolvedValue(undefined);
        getAppKv.mockImplementation(async () => {
            // Settings wrote MAD locally while an older EUR hydrate was in flight.
            await saveInvoicePracticeToStorage({ ...practice, currency: "MAD" });
            return JSON.stringify({ ...practice, currency: "EUR" });
        });

        const hydrated = await hydrateInvoicePracticeFromAppKv();
        expect(hydrated?.currency).toBe("MAD");
        expect(getInvoicePracticeFromStorage().currency).toBe("MAD");
        expect(practiceCurrency()).toBe("MAD");
    });
});
