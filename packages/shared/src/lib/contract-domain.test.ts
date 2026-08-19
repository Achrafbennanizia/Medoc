import { describe, expect, it } from "vitest";
import { amountEquivalentPerMonth, contractActiveToday, type ContractItem } from "./contract-domain";

describe("contract-domain", () => {
    it("year to month equivalent", () => {
        expect(amountEquivalentPerMonth(840, "YEAR")).toBeCloseTo(70, 2);
    });

    it("contractActiveToday for fixed_term in range", () => {
        const version: ContractItem = {
            id: "1",
            designation: "x",
            partner: "y",
            amount: 1,
            interval: "MONTH",
            unlimited: false,
            periodFrom: "2020-01-01",
            periodUntil: "2040-12-31",
            createdAt: "",
            documentPath: null,
        };
        expect(version.unlimited).toBe(false);
        const vPast: ContractItem = { ...version, periodUntil: "2000-01-01" };
        const t = new Date();
        const ymd = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
        expect(contractActiveToday(version)).toBe(ymd >= "2020-01-01" && ymd <= "2040-12-31");
        expect(contractActiveToday(vPast)).toBe(false);
    });
});
