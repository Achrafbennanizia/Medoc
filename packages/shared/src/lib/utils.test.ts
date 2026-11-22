import { describe, expect, it } from "vitest";
import {
    addCalendarDays,
    escapeHtml,
    formatDate,
    formatTpl,
    hueFromId,
    inclusiveCalendarDays,
    initialsFromName,
    kpiValueSizeClass,
    parseDisplayDate,
} from "./utils";

describe("escapeHtml", () => {
    it("escapes HTML special characters", () => {
        // `escapeHtml` replaces `&` first so literals stay well-formed (OWASP-style).
        expect(escapeHtml(`<&>"'`)).toBe("&lt;&amp;&gt;&quot;&#39;");
    });

    it("escapes ampersand before angle brackets", () => {
        expect(escapeHtml("a & b < c")).toBe("a &amp; b &lt; c");
    });

    it("escapes empty string", () => {
        expect(escapeHtml("")).toBe("");
    });
});

describe("hueFromId", () => {
    it("stays in range and stays put for the same id", () => {
        const a = hueFromId("staff-1");
        expect(a).toBe(hueFromId("staff-1"));
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThan(360);
    });
});

describe("initialsFromName", () => {
    it("uses the first and last name", () => {
        expect(initialsFromName("Ada West Extra")).toBe("AE");
        expect(initialsFromName("Ada")).toBe("AD");
        expect(initialsFromName("   ")).toBe("?");
    });
});

describe("parseDisplayDate", () => {
    it("keeps a calendar day on that day", () => {
        const d = parseDisplayDate("2026-11-20");
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(10);
        expect(d.getDate()).toBe(20);
        expect(formatDate("2026-11-20", "en")).toContain("20");
    });

    it("reads a database timestamp as UTC", () => {
        expect(parseDisplayDate("2026-11-20 23:30:00").toISOString()).toBe("2026-11-20T23:30:00.000Z");
    });

    it("counts and shifts written calendar days", () => {
        expect(inclusiveCalendarDays("2026-11-20", "2026-11-20")).toBe(1);
        expect(inclusiveCalendarDays("2026-11-20", "2026-11-22")).toBe(3);
        expect(addCalendarDays("2026-11-20", 2)).toBe("2026-11-22");
    });
});

describe("formatTpl", () => {
    it("interpolates named placeholders", () => {
        expect(formatTpl("Hi {name}, count {n}", { name: "A", n: 3 })).toBe("Hi A, count 3");
    });

    it("leaves unknown keys empty", () => {
        expect(formatTpl("{a}-{b}", { a: "1" })).toBe("1-");
    });
});

describe("kpiValueSizeClass", () => {
    it("keeps short values at the base size", () => {
        expect(kpiValueSizeClass("729")).toBe("kpi-val");
        expect(kpiValueSizeClass("2,887")).toBe("kpi-val");
    });

    it("tightens long currency strings", () => {
        expect(kpiValueSizeClass("CHF 462,880.00")).toBe("kpi-val kpi-val--long");
        expect(kpiValueSizeClass("CHF 12,345,678.90")).toBe("kpi-val kpi-val--xl");
    });

    it("accepts a custom base class", () => {
        expect(kpiValueSizeClass("CHF 462,880.00", "finance-kpi__val")).toBe(
            "finance-kpi__val finance-kpi__val--long",
        );
    });
});
