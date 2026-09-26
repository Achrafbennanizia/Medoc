import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("toast stack placement policy", () => {
    it("anchors notifications to bottom-right", () => {
        const css = readFileSync(path.resolve(process.cwd(), "src/index.css"), "utf8");
        const match = css.match(/\.toast-stack\s*\{[^}]+\}/);
        expect(match, "toast-stack CSS block should exist").toBeTruthy();
        const block = match?.[0] ?? "";

        expect(block).toContain("bottom:");
        expect(block).toContain("right:");
        expect(block).not.toContain("top:");
    });
});
