#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const targets = [
    path.resolve(root, "src"),
    path.resolve(root, "../../packages/app/practice-host/src"),
    path.resolve(root, "../../packages/ui/src"),
];

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const arbitraryTokenPattern =
    /\b(?:p[trblxy]?|m[trblxy]?|gap(?:-[xy])?|space-[xy]|w|min-w|max-w|h|min-h|max-h|inset(?:-[xy])?|top|right|bottom|left|rounded(?:-[trbl]{1,2})?)-\[[^\]]+\]/g;

function* walkFiles(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
            continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            yield* walkFiles(fullPath);
            continue;
        }
        if (!sourceExtensions.has(path.extname(entry.name))) continue;
        yield fullPath;
    }
}

function collectViolations(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const violations = [];
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
        for (const match of line.matchAll(arbitraryTokenPattern)) {
            const token = match[0];
            violations.push({
                token,
                line: idx + 1,
            });
        }
    });
    return violations;
}

const allViolations = [];
for (const target of targets) {
    for (const filePath of walkFiles(target)) {
        const violations = collectViolations(filePath);
        if (violations.length === 0) continue;
        allViolations.push({
            filePath,
            violations,
        });
    }
}

if (allViolations.length === 0) {
    console.log("tailwind-scale-lint: ok");
    process.exit(0);
}

console.error("tailwind-scale-lint: arbitrary token values detected");
for (const hit of allViolations) {
    const rel = path.relative(root, hit.filePath);
    for (const v of hit.violations) {
        console.error(`  ${rel}:${v.line} ${v.token}`);
    }
}
process.exit(1);
