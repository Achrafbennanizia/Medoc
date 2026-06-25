#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const WORKSPACE_ROOT = process.cwd();
const TARGET_DIRS = [
    "apps/practice-host-ui/src",
    "packages/ui/src",
    "packages/app/practice-host/src",
];
const SOURCE_EXT_RE = /\.(tsx?|jsx?)$/;
const SPACING_ARBITRARY_RE =
    /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y|w|h|min-w|min-h|max-w|max-h)-\[[^\]]+\]/g;

function walk(dir, out) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, out);
            continue;
        }
        if (SOURCE_EXT_RE.test(entry.name)) {
            out.push(fullPath);
        }
    }
}

function collectFiles() {
    const files = [];
    for (const relDir of TARGET_DIRS) {
        const absDir = join(WORKSPACE_ROOT, relDir);
        try {
            if (statSync(absDir).isDirectory()) {
                walk(absDir, files);
            }
        } catch {
            // Skip missing optional dirs.
        }
    }
    return files;
}

function scanFile(path) {
    const text = readFileSync(path, "utf8");
    const lines = text.split(/\r?\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const matches = line.match(SPACING_ARBITRARY_RE);
        if (!matches) continue;
        for (const match of matches) {
            hits.push({
                file: relative(WORKSPACE_ROOT, path),
                line: i + 1,
                token: match,
            });
        }
    }
    return hits;
}

const files = collectFiles();
const allHits = files.flatMap(scanFile);

if (allHits.length === 0) {
    console.log("tailwind-spacing-lint: PASS (no arbitrary spacing tokens found)");
    process.exit(0);
}

console.log("tailwind-spacing-lint: FAIL (arbitrary spacing tokens detected)");
for (const hit of allHits) {
    console.log(`- ${hit.file}:${hit.line} ${hit.token}`);
}
process.exit(1);
