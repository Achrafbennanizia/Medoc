#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_ROOTS = [
    path.join(ROOT, "apps", "practice-host-ui", "src"),
    path.join(ROOT, "packages"),
];
const EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ARBITRARY_TW_RE =
    /\b(?:p[trblxy]?|m[trblxy]?|gap[xy]?|space-[xy]|w|h|min-w|min-h|max-w|max-h)-\[[^\]]+\]/g;

async function listFiles(dir) {
    const out = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...(await listFiles(full)));
        } else if (EXTS.has(path.extname(entry.name))) {
            out.push(full);
        }
    }
    return out;
}

function lineForOffset(text, offset) {
    let line = 1;
    for (let i = 0; i < offset; i += 1) {
        if (text[i] === "\n") line += 1;
    }
    return line;
}

async function run() {
    const violations = [];
    for (const scanRoot of SCAN_ROOTS) {
        let files = [];
        try {
            files = await listFiles(scanRoot);
        } catch {
            continue;
        }
        for (const file of files) {
            const content = await fs.readFile(file, "utf8");
            for (const match of content.matchAll(ARBITRARY_TW_RE)) {
                const token = match[0];
                const offset = match.index ?? 0;
                violations.push({
                    file: path.relative(ROOT, file),
                    line: lineForOffset(content, offset),
                    token,
                });
            }
        }
    }

    if (violations.length === 0) {
        console.log("tailwind-arbitrary-values: OK (no arbitrary spacing/size tokens found)");
        return;
    }

    console.error("tailwind-arbitrary-values: violations found");
    for (const violation of violations) {
        console.error(
            ` - ${violation.file}:${violation.line} uses ${violation.token}`,
        );
    }
    process.exit(1);
}

run().catch((err) => {
    console.error("tailwind-arbitrary-values: failed", err);
    process.exit(1);
});
