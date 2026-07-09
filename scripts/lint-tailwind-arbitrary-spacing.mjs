#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(scriptDir, "..");
const TARGET_DIRS = [
    path.join(ROOT, "apps/practice-host-ui/src"),
    path.join(ROOT, "packages"),
];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const SKIP_DIR_NAMES = new Set(["node_modules", ".git", "dist", "coverage", "target"]);
const ARBITRARY_SPACING_RE =
    /\b(?:p[trblxy]?|m[trblxy]?|gap(?:-[xy])?|space-[xy]|w|min-w|max-w|h|min-h|max-h)-\[[^\]]+\]/g;

async function collectSourceFiles(startDir, out = []) {
    let entries;
    try {
        entries = await fs.readdir(startDir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        if (SKIP_DIR_NAMES.has(entry.name)) {
            continue;
        }
        const fullPath = path.join(startDir, entry.name);
        if (entry.isDirectory()) {
            await collectSourceFiles(fullPath, out);
            continue;
        }
        if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
            continue;
        }
        out.push(fullPath);
    }
    return out;
}

function lineAndColumn(source, offset) {
    const before = source.slice(0, offset);
    const lines = before.split("\n");
    return {
        line: lines.length,
        col: lines[lines.length - 1].length + 1,
    };
}

const violations = [];
for (const dir of TARGET_DIRS) {
    const files = await collectSourceFiles(dir);
    for (const file of files) {
        const text = await fs.readFile(file, "utf8");
        for (const match of text.matchAll(ARBITRARY_SPACING_RE)) {
            const token = match[0];
            const idx = match.index ?? 0;
            const pos = lineAndColumn(text, idx);
            violations.push({
                file: path.relative(ROOT, file),
                line: pos.line,
                col: pos.col,
                token,
            });
        }
    }
}

if (violations.length === 0) {
    console.log("tailwind-arbitrary-spacing: OK (no arbitrary spacing tokens found)");
    process.exit(0);
}

console.error("tailwind-arbitrary-spacing: arbitrary spacing tokens detected");
for (const v of violations) {
    console.error(`- ${v.file}:${v.line}:${v.col} -> ${v.token}`);
}
process.exit(1);
