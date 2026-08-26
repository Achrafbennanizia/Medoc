import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

describe("toast layout policy", () => {
    it("pins toast stack to bottom-right", () => {
        const cssPath = resolve(fileURLToPath(new URL("./index.css", import.meta.url)));
        const css = readFileSync(cssPath, "utf8");
        const block = css.match(/\.toast-stack\s*\{([^}]+)\}/m)?.[1] ?? "";

        expect(block).toContain("bottom:");
        expect(block).toContain("right:");
        expect(block).not.toContain("top:");
    });
});
