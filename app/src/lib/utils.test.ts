import { describe, expect, it } from "vitest";
import { escapeHtml, formatTpl } from "./utils";

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

describe("formatTpl", () => {
    it("interpolates named placeholders", () => {
        expect(formatTpl("Hi {name}, count {n}", { name: "A", n: 3 })).toBe("Hi A, count 3");
    });

    it("leaves unknown keys empty", () => {
        expect(formatTpl("{a}-{b}", { a: "1" })).toBe("1-");
    });
});
