#!/usr/bin/env node
/**
 * Keeps source files small and single-purpose (docs/engineering/file-size-rule.md).
 *
 *   node scripts/check-file-size.mjs            check (CI): fails on a new oversized file or a file that grew
 *   node scripts/check-file-size.mjs --update   lower the baseline after shrinking files (never raises it)
 *   node scripts/check-file-size.mjs --report   ranked list of files over the limit
 *
 * Ratchet: files already over the limit when the rule arrived are listed in file-size-baseline.json with
 * their size then. They may only shrink. Every other file must stay within the limit for its type.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASELINE = path.join(ROOT, "scripts", "file-size-baseline.json");

/** Max lines per file type. Rust is higher: unit tests live in the same file (`mod tests`). */
export const LIMITS = { ".ts": 400, ".tsx": 400, ".css": 400, ".mjs": 400, ".rs": 600 };

/** Generated, vendored and data files are not hand-written code. */
const IGNORE = [/node_modules\//, /(^|\/)target\//, /\/dist\//, /\.generated\./, /^third_party\//, /migrations\/generated\//, /\.npm-cache\//, /\.d\.ts$/];

/** Generated files (header says `@generated`) are rebuilt by tools, not edited by hand. */
function isGenerated(file) {
    const head = fs.readFileSync(path.join(ROOT, file), "utf8").slice(0, 400);
    return head.includes("@generated");
}

function sourceFiles() {
    const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
    return out
        .split("\n")
        .filter((f) => f && LIMITS[path.extname(f)] && !IGNORE.some((re) => re.test(f)) && fs.existsSync(path.join(ROOT, f)) && !isGenerated(f));
}

function lineCount(file) {
    const text = fs.readFileSync(path.join(ROOT, file), "utf8");
    return text.length === 0 ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

function readBaseline() {
    try {
        return JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    } catch {
        return {};
    }
}

function writeBaseline(map) {
    const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + "\n");
}

const mode = process.argv[2] ?? "--check";
const baseline = readBaseline();
const sizes = new Map(sourceFiles().map((f) => [f, lineCount(f)]));
const over = [...sizes].filter(([f, n]) => n > LIMITS[path.extname(f)]);

if (mode === "--report") {
    for (const [f, n] of over.sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(5)}  ${f}`);
    console.log(`[size] ${over.length} files over the limit`);
    process.exit(0);
}

if (mode === "--update" || mode === "--init") {
    const next = {};
    for (const [f, n] of over) {
        // --init records today's sizes; --update only lowers existing entries and never adds new ones.
        if (mode === "--init") next[f] = n;
        else if (baseline[f] != null) next[f] = Math.min(baseline[f], n);
    }
    writeBaseline(next);
    console.log(`[size] baseline: ${Object.keys(next).length} files (was ${Object.keys(baseline).length})`);
    process.exit(0);
}

const problems = [];
for (const [f, n] of over) {
    const limit = LIMITS[path.extname(f)];
    if (baseline[f] == null) problems.push(`${f}: ${n} lines (limit ${limit}) — split it by responsibility`);
    else if (n > baseline[f]) problems.push(`${f}: grew to ${n} lines (baseline ${baseline[f]}) — move the new code to its own file`);
}
const shrunk = Object.entries(baseline).filter(([f, n]) => (sizes.get(f) ?? 0) < n).length;
if (problems.length) {
    console.error(`[size] ${problems.length} file(s) break the file-size rule (docs/engineering/file-size-rule.md):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
}
console.log(`[size] ok — ${over.length} legacy files over the limit, none grew${shrunk ? `; ${shrunk} shrank (run --update to lock that in)` : ""}`);
