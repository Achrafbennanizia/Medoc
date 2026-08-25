#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const roots = [
    "/workspace/apps/practice-host-ui/src",
    "/workspace/packages",
];

const spacingClassPattern =
    /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y|min-h|min-w|max-h|max-w|h|w)-\[[^\]]+\]/g;
const includeExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function walk(dir, out) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
                continue;
            }
            await walk(full, out);
            continue;
        }
        if (!includeExtensions.has(extname(entry.name))) continue;
        out.push(full);
    }
}

function indexToLineCol(source, index) {
    let line = 1;
    let col = 1;
    for (let i = 0; i < index; i += 1) {
        if (source[i] === "\n") {
            line += 1;
            col = 1;
        } else {
            col += 1;
        }
    }
    return { line, col };
}

const files = [];
for (const root of roots) {
    const st = await stat(root).catch(() => null);
    if (st?.isDirectory()) {
        await walk(root, files);
    }
}

const hits = [];
for (const file of files) {
    const source = await readFile(file, "utf8");
    const matches = source.matchAll(spacingClassPattern);
    for (const match of matches) {
        const at = indexToLineCol(source, match.index ?? 0);
        hits.push({
            file: file.replace("/workspace/", ""),
            line: at.line,
            col: at.col,
            className: match[0],
        });
    }
}

if (hits.length === 0) {
    console.log("tailwind-arbitrary-spacing: PASS (no arbitrary spacing classes found)");
    process.exit(0);
}

console.error("tailwind-arbitrary-spacing: FAIL");
for (const hit of hits) {
    console.error(`- ${hit.file}:${hit.line}:${hit.col} -> ${hit.className}`);
}
process.exit(1);
