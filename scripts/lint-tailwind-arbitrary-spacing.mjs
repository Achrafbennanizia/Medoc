#!/usr/bin/env node
/**
 * Fails when spacing-related Tailwind arbitrary values are used (e.g. `p-[13px]`).
 * This keeps spacing on the token scale from tailwind config.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCAN_ROOTS = [
    "apps/practice-host-ui/src",
    "packages/app/practice-host/src",
    "packages/server/lan/src",
    "packages/server/company/src",
    "packages/ui/src",
];

const FILE_EXT_RE = /\.(ts|tsx|js|jsx)$/;
const ARBITRARY_SPACING_RE =
    /(?:^|[\s"'`])(?:[a-z-]+:)*(?<token>(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y|min-h|min-w|max-h|max-w|h|w|rounded)-\[[^\]]+\])/g;

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        const st = statSync(path);
        if (st.isDirectory()) {
            if (name === "node_modules" || name === "dist" || name === "coverage") continue;
            walk(path, out);
            continue;
        }
        if (FILE_EXT_RE.test(name)) out.push(path);
    }
    return out;
}

function lineOf(content, idx) {
    let line = 1;
    for (let i = 0; i < idx; i += 1) {
        if (content.charCodeAt(i) === 10) line += 1;
    }
    return line;
}

const findings = [];
for (const relRoot of SCAN_ROOTS) {
    const absRoot = join(root, relRoot);
    let files = [];
    try {
        files = walk(absRoot);
    } catch {
        continue;
    }
    for (const file of files) {
        const content = readFileSync(file, "utf8");
        ARBITRARY_SPACING_RE.lastIndex = 0;
        for (const match of content.matchAll(ARBITRARY_SPACING_RE)) {
            const token = match.groups?.token ?? match[0].trim();
            const idx = match.index ?? 0;
            findings.push({
                file: relative(root, file),
                line: lineOf(content, idx),
                token,
            });
        }
    }
}

if (findings.length > 0) {
    console.error("[tailwind:spacing] Arbitrary spacing values detected:");
    for (const hit of findings) {
        console.error(`  ${hit.file}:${hit.line} -> ${hit.token}`);
    }
    process.exit(1);
}

console.log("[tailwind:spacing] OK — no arbitrary spacing utilities found.");
