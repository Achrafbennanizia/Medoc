#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const DEFAULT_TARGETS = ["apps/practice-host-ui/src", "packages"];
const IGNORE_DIRS = new Set([
    ".git",
    ".turbo",
    ".vite",
    ".cursor",
    "coverage",
    "dist",
    "node_modules",
    "target",
]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);
const SPACING_ARBITRARY_RE =
    /\b(?:p[trblxy]?|m[trblxy]?|gap(?:-[xy])?|space-[xy]|w|h|min-w|min-h|max-w|max-h)-\[[^\]\s"'`]+\]/g;

const cwd = process.cwd();
const targets = process.argv.slice(2);
const roots = targets.length > 0 ? targets : DEFAULT_TARGETS;

/** @param {string} absPath */
function shouldWalk(absPath) {
    const name = path.basename(absPath);
    if (IGNORE_DIRS.has(name)) return false;
    return true;
}

/** @param {string} absPath */
function walk(absPath) {
    if (!shouldWalk(absPath)) return [];
    const st = statSync(absPath);
    if (st.isDirectory()) {
        const out = [];
        for (const entry of readdirSync(absPath)) {
            out.push(...walk(path.join(absPath, entry)));
        }
        return out;
    }
    if (!st.isFile()) return [];
    if (!SOURCE_EXTENSIONS.has(path.extname(absPath))) return [];
    return [absPath];
}

const violations = [];

for (const relRoot of roots) {
    const absRoot = path.resolve(cwd, relRoot);
    for (const file of walk(absRoot)) {
        const content = readFileSync(file, "utf8");
        const lines = content.split("\n");
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i] ?? "";
            const matches = line.match(SPACING_ARBITRARY_RE);
            if (!matches) continue;
            for (const token of matches) {
                violations.push({
                    file: path.relative(cwd, file),
                    line: i + 1,
                    token,
                });
            }
        }
    }
}

if (violations.length === 0) {
    console.log("tailwind-spacing-lint: no arbitrary spacing tokens found");
    process.exit(0);
}

console.error("tailwind-spacing-lint: found arbitrary spacing tokens");
for (const v of violations) {
    console.error(` - ${v.file}:${v.line} -> ${v.token}`);
}
process.exit(1);
