#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_ROOTS = ["apps/practice-host-ui/src", "packages"];
const FILE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "coverage", "target"]);
const ARBITRARY_SPACING_RE = /\b(?:p[trblxy]?|m[trblxy]?|gap|space-[xy])-\[[^\]]+\]/g;

function isIgnoredDir(dirName) {
    return IGNORED_DIRS.has(dirName);
}

async function walkFiles(rootDir, outFiles) {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(rootDir, entry.name);
        if (entry.isDirectory()) {
            if (isIgnoredDir(entry.name)) {
                continue;
            }
            await walkFiles(fullPath, outFiles);
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        if (!FILE_EXTENSIONS.has(path.extname(entry.name))) {
            continue;
        }
        outFiles.push(fullPath);
    }
}

async function collectFiles(roots) {
    const files = [];
    for (const root of roots) {
        try {
            const stat = await fs.stat(root);
            if (!stat.isDirectory()) {
                continue;
            }
            await walkFiles(root, files);
        } catch {
            // Ignore missing roots to keep local/CI path differences resilient.
        }
    }
    return files;
}

async function main() {
    const rawRoots = process.argv.slice(2);
    const roots = (rawRoots.length > 0 ? rawRoots : DEFAULT_ROOTS).map((relativeOrAbsolute) =>
        path.resolve(process.cwd(), relativeOrAbsolute),
    );
    const files = await collectFiles(roots);
    const violations = [];

    for (const filePath of files) {
        const content = await fs.readFile(filePath, "utf8");
        const lines = content.split(/\r?\n/u);
        lines.forEach((line, index) => {
            const matches = [...line.matchAll(ARBITRARY_SPACING_RE)];
            if (matches.length === 0) {
                return;
            }
            for (const match of matches) {
                violations.push({
                    filePath,
                    lineNumber: index + 1,
                    token: match[0],
                });
            }
        });
    }

    if (violations.length === 0) {
        console.log("tailwind-spacing-lint: PASS (no arbitrary spacing utilities found)");
        return;
    }

    console.error("tailwind-spacing-lint: FAIL (arbitrary spacing utilities found)");
    for (const violation of violations) {
        const relPath = path.relative(process.cwd(), violation.filePath);
        console.error(`- ${relPath}:${violation.lineNumber} -> ${violation.token}`);
    }
    process.exitCode = 1;
}

void main();
