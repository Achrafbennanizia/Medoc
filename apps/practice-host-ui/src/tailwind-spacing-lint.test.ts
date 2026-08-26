import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CHECK_DIRS = [
    path.join(ROOT, "src"),
    path.resolve(ROOT, "../../packages"),
];
const SOURCE_FILE_RE = /\.[cm]?[jt]sx?$/;
const IGNORE_DIRS = new Set(["node_modules", "dist", "coverage", "target", ".git"]);
const ARBITRARY_SPACING_RE =
    /(?:^|[\s"'`])(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y)-\[[^\]]+\]/g;

function collectSourceFiles(dir: string, out: string[]) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (IGNORE_DIRS.has(entry.name)) continue;
            collectSourceFiles(path.join(dir, entry.name), out);
            continue;
        }
        if (SOURCE_FILE_RE.test(entry.name)) {
            out.push(path.join(dir, entry.name));
        }
    }
}

describe("tailwind spacing token lint", () => {
    it("rejects arbitrary spacing classes that bypass the spacing scale", () => {
        const files: string[] = [];
        for (const dir of CHECK_DIRS) {
            collectSourceFiles(dir, files);
        }

        const violations: string[] = [];
        for (const file of files) {
            const content = readFileSync(file, "utf8");
            const matches = content.match(ARBITRARY_SPACING_RE);
            if (!matches || matches.length === 0) {
                continue;
            }
            const rel = path.relative(ROOT, file);
            const unique = [...new Set(matches)];
            violations.push(`${rel}: ${unique.join(", ")}`);
        }

        expect(
            violations,
            `Found arbitrary Tailwind spacing values:\n${violations.join("\n")}`,
        ).toEqual([]);
    });
});
