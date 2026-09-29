import { describe, expect, it, vi } from "vitest";

vi.mock("@/systems/practice-host/adapters/tauri-practice.adapter", () => ({
    practiceSystem: { invoke: vi.fn() },
}));

import { normalizeInvoiceInput, sumInvoiceEur } from "./invoice-document.controller";

describe("normalizeInvoiceInput", () => {
    it("fills missing address arrays so UI join does not throw", () => {
        const inv = normalizeInvoiceInput(
            { number: "RE-1", date: "2026-09-29", recipient_name: "Ada" },
            { number: "fallback", date: "2020-01-01" },
        );
        expect(inv.recipient_address).toEqual([]);
        expect(inv.practice_address).toEqual([]);
        expect(inv.lines).toEqual([]);
        expect(inv.number).toBe("RE-1");
        expect(inv.recipient_address.join("\n")).toBe("");
        expect(sumInvoiceEur(inv)).toBe(0);
    });

    it("accepts a single address string", () => {
        const inv = normalizeInvoiceInput({ recipient_address: "Street 1\nBerlin" });
        expect(inv.recipient_address).toEqual(["Street 1", "Berlin"]);
    });
});
