#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = [
    "apps/practice-host-ui/src",
    "packages/app/practice-host/src",
    "packages/ui/src",
];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".html"]);
const ARBITRARY_SPACING_RE =
    /\b(?:p[trblxy]?|m[trblxy]?|gap(?:-[xy])?|space-[xy]|inset(?:-[xy])?|top|right|bottom|left)-\[[^\]]+\]/g;

function walk(dir, out) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath, out);
            continue;
        }
        if (!entry.isFile()) continue;
        if (!EXTENSIONS.has(path.extname(entry.name))) continue;
        out.push(fullPath);
    }
}

const files = [];
for (const relDir of TARGET_DIRS) {
    const absolute = path.join(ROOT, relDir);
    try {
        if (statSync(absolute).isDirectory()) walk(absolute, files);
    } catch {
        // Directory does not exist in this checkout.
    }
}

const findings = [];
for (const file of files) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const matches = [...line.matchAll(ARBITRARY_SPACING_RE)];
        for (const match of matches) {
            findings.push({
                file: path.relative(ROOT, file),
                line: i + 1,
                token: match[0],
                snippet: line.trim(),
            });
        }
    }
}

if (findings.length === 0) {
    console.log("tailwind-spacing-lint: PASS (no arbitrary spacing tokens found)");
    process.exit(0);
}

console.error("tailwind-spacing-lint: FAIL (arbitrary spacing tokens found)");
for (const finding of findings) {
    console.error(
        ` - ${finding.file}:${finding.line} token=${finding.token} :: ${finding.snippet}`,
    );
}
process.exit(1);
