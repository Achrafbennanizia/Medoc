#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const SOURCE_ROOTS = [
    path.resolve(process.cwd(), "src"),
    path.resolve(process.cwd(), "../../packages"),
];

const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "coverage", "target"]);
const ARBITRARY_TOKEN_RE =
    /(?:^|[\s"'`])((?:p[trblxy]?|m[trblxy]?|gap(?:-[xy])?|space-[xy]|w|h|min-w|min-h|max-w|max-h)-\[[^\]\s]+])/g;

async function walk(dir) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const files = [];
    for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walk(full)));
            continue;
        }
        if (!FILE_EXTENSIONS.has(path.extname(entry.name))) continue;
        files.push(full);
    }
    return files;
}

function scanContent(content, filePath) {
    const findings = [];
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] ?? "";
        ARBITRARY_TOKEN_RE.lastIndex = 0;
        for (const match of line.matchAll(ARBITRARY_TOKEN_RE)) {
            const token = match[1];
            if (!token) continue;
            findings.push({
                file: filePath,
                line: i + 1,
                token,
            });
        }
    }
    return findings;
}

async function main() {
    const allFiles = (
        await Promise.all(SOURCE_ROOTS.map((root) => walk(root)))
    ).flat();
    const findings = [];
    for (const filePath of allFiles) {
        const content = await fs.readFile(filePath, "utf8");
        findings.push(...scanContent(content, filePath));
    }

    if (findings.length === 0) {
        console.log("tailwind-token-scale: PASS (no arbitrary spacing/size tokens found)");
        return;
    }

    console.error("tailwind-token-scale: FAIL");
    for (const finding of findings) {
        const rel = path.relative(process.cwd(), finding.file);
        console.error(`  ${rel}:${finding.line} -> ${finding.token}`);
    }
    process.exitCode = 1;
}

await main();
