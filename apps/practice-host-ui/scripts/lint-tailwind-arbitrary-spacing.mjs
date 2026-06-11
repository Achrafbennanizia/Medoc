#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const roots = [
    path.resolve(__dirname, "../src"),
    path.resolve(__dirname, "../../../packages"),
];

const fileExt = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ignoredDirs = new Set(["node_modules", "dist", "coverage", "target", ".git"]);
const ARBITRARY_SPACING_RE =
    /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|space-x|space-y|w|h|min-w|min-h|max-w|max-h|inset|top|right|bottom|left)-\[[^\]\r\n]+\]/g;

function collectFiles(dir, out) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (ignoredDirs.has(entry.name)) continue;
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectFiles(abs, out);
            continue;
        }
        if (fileExt.has(path.extname(entry.name))) {
            out.push(abs);
        }
    }
}

function lineNumberAt(text, index) {
    let line = 1;
    for (let i = 0; i < index; i += 1) {
        if (text.charCodeAt(i) === 10) line += 1;
    }
    return line;
}

const files = [];
for (const root of roots) {
    if (statSync(root, { throwIfNoEntry: false })?.isDirectory()) {
        collectFiles(root, files);
    }
}

const findings = [];
for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(ARBITRARY_SPACING_RE)) {
        const token = match[0];
        const line = lineNumberAt(content, match.index ?? 0);
        findings.push({
            file: path.relative(path.resolve(__dirname, ".."), file),
            line,
            token,
        });
    }
}

if (findings.length > 0) {
    console.error(
        "Tailwind spacing lint failed: arbitrary spacing utilities are not allowed.",
    );
    for (const finding of findings) {
        console.error(` - ${finding.file}:${finding.line} → ${finding.token}`);
    }
    process.exit(1);
}

console.log("Tailwind spacing lint passed.");
