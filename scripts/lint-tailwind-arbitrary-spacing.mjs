#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SEARCH_DIRS = [
    path.join(ROOT, "apps/practice-host-ui/src"),
    path.join(ROOT, "packages"),
];

const FILE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const SPACING_ARBITRARY_RE =
    /(?:^|[\s"'`])(?:[a-z0-9-]+:)*(?:p[trblxy]?|m[trblxy]?|gap[xy]?|space-[xy]|w|h|min-w|min-h|max-w|max-h)-\[[^\]]+\]/gi;

function walkFiles(dir, out) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
            continue;
        }
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(abs, out);
        } else if (entry.isFile() && FILE_EXTS.has(path.extname(entry.name))) {
            out.push(abs);
        }
    }
}

function collectViolations(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const violations = [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const hits = line.match(SPACING_ARBITRARY_RE);
        if (!hits) continue;
        for (const hit of hits) {
            violations.push({
                file: path.relative(ROOT, filePath),
                line: i + 1,
                token: hit.trim(),
            });
        }
    }
    return violations;
}

const files = [];
for (const dir of SEARCH_DIRS) {
    walkFiles(dir, files);
}

const violations = files.flatMap(collectViolations);
if (violations.length === 0) {
    console.log("tailwind-spacing-lint: PASS (no arbitrary spacing classes found)");
    process.exit(0);
}

console.error(
    `tailwind-spacing-lint: FAIL (${violations.length} arbitrary spacing class token(s) found)`,
);
for (const entry of violations) {
    console.error(`  ${entry.file}:${entry.line}  ${entry.token}`);
}
process.exit(1);
