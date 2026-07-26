#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const WORKSPACE_ROOT = process.cwd();
const TARGETS = process.argv.slice(2);
const SEARCH_ROOTS = TARGETS.length > 0 ? TARGETS : ["apps/practice-host-ui/src", "packages/ui/src"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

const spacingUtilityRe =
    /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|min-h|min-w|w|h|max-w|max-h)-\[[^\]]+\]/g;

function walkFiles(rootAbs, files = []) {
    const entries = fs.readdirSync(rootAbs, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") continue;
        const nextAbs = path.join(rootAbs, entry.name);
        if (entry.isDirectory()) {
            walkFiles(nextAbs, files);
            continue;
        }
        if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
            files.push(nextAbs);
        }
    }
    return files;
}

function lintFile(absPath) {
    const relativePath = path.relative(WORKSPACE_ROOT, absPath);
    const text = fs.readFileSync(absPath, "utf8");
    const lines = text.split(/\r?\n/);
    const violations = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const matches = line.matchAll(spacingUtilityRe);
        for (const match of matches) {
            violations.push({
                path: relativePath,
                line: i + 1,
                utility: match[0],
            });
        }
    }
    return violations;
}

const violations = [];

for (const root of SEARCH_ROOTS) {
    const absRoot = path.resolve(WORKSPACE_ROOT, root);
    if (!fs.existsSync(absRoot)) continue;
    const files = walkFiles(absRoot);
    for (const file of files) {
        violations.push(...lintFile(file));
    }
}

if (violations.length === 0) {
    console.log("tailwind-spacing-lint: no arbitrary spacing utilities found");
    process.exit(0);
}

console.error("tailwind-spacing-lint: arbitrary spacing utilities detected:");
for (const item of violations) {
    console.error(`- ${item.path}:${item.line} -> ${item.utility}`);
}
console.error("Use spacing tokens/classes from tailwind.config.js instead of bracket literals.");
process.exit(1);
