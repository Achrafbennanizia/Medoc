#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");

const roots = [
    path.join(projectDir, "src"),
    path.resolve(projectDir, "../../packages/ui/src"),
    path.resolve(projectDir, "../../packages/app/practice-host/src"),
    path.resolve(projectDir, "../../packages/shared/src"),
];

const validExt = new Set([".ts", ".tsx", ".js", ".jsx"]);
const arbitrarySpacingPattern =
    /\b(?:-?m[trblxy]?|p[trblxy]?|gap[xy]?|space-[xy]|w|h|min-w|min-h|max-w|max-h)-\[[^\]]+\]/g;

function walk(dir, files = []) {
    for (const entry of readdirSync(dir)) {
        const absolute = path.join(dir, entry);
        const stat = statSync(absolute);
        if (stat.isDirectory()) {
            walk(absolute, files);
            continue;
        }
        if (validExt.has(path.extname(absolute))) files.push(absolute);
    }
    return files;
}

const violations = [];

for (const root of roots) {
    for (const file of walk(root)) {
        const source = readFileSync(file, "utf8");
        const matches = source.match(arbitrarySpacingPattern);
        if (!matches || matches.length === 0) continue;
        violations.push({
            file: path.relative(projectDir, file),
            matches: [...new Set(matches)].sort(),
        });
    }
}

if (violations.length > 0) {
    console.error("Tailwind spacing-scale lint failed. Arbitrary spacing/size classes detected:");
    for (const violation of violations) {
        console.error(`- ${violation.file}`);
        for (const match of violation.matches) console.error(`    ${match}`);
    }
    process.exit(1);
}

console.log("Tailwind spacing-scale lint passed (no arbitrary spacing/size classes found).");
