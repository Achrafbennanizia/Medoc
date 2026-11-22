import { describe, expect, it } from "vitest";
import { amountEquivalentPerMonth, contractActiveToday, type ContractItem } from "./contract-domain";
import { localIsoDate } from "./utils";

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
        const ymd = localIsoDate(t);
        expect(contractActiveToday(version)).toBe(ymd >= "2020-01-01" && ymd <= "2040-12-31");
        expect(contractActiveToday(vPast)).toBe(false);
    });
});

import { contractCostBetween, contractStatus } from "./contract-domain";

describe("contract activation and cost", () => {
    const base: ContractItem = {
        id: "c", designation: "Rent", partner: "X", amount: 3000, interval: "MONTH", unlimited: true,
        periodFrom: null, periodUntil: null, createdAt: "2026-01-01T00:00:00Z", documentPath: null,
    };
    it("derives the lifecycle status", () => {
        expect(contractStatus(base, "2026-06-01")).toBe("ACTIVE");
        expect(contractStatus({ ...base, active: false, deactivatedAt: "2026-03-31" }, "2026-06-01")).toBe("INACTIVE");
        expect(contractStatus({ ...base, unlimited: false, periodFrom: "2026-07-01", periodUntil: "2026-12-31" }, "2026-06-01")).toBe("NOT_STARTED");
        expect(contractStatus({ ...base, unlimited: false, periodFrom: "2025-01-01", periodUntil: "2025-12-31" }, "2026-06-01")).toBe("EXPIRED");
    });
    it("stops counting cost on the deactivation day", () => {
        const year = contractCostBetween(base, "2026-01-01", "2026-12-31");
        const off = contractCostBetween({ ...base, active: false, deactivatedAt: "2026-06-30" }, "2026-01-01", "2026-12-31");
        expect(year).toBeCloseTo(36000, -2);
        expect(off).toBeGreaterThan(17000);
        expect(off).toBeLessThan(18200);
        expect(contractCostBetween({ ...base, active: false, deactivatedAt: "2025-12-31" }, "2026-01-01", "2026-12-31")).toBe(0);
    });
});
