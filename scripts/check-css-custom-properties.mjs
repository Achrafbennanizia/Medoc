#!/usr/bin/env node
/**
 * Fail when a custom property is used as var(--token) with no fallback and is
 * never declared in CSS or assigned from script.
 *
 * var(--token, fallback) is allowed: the fallback is the specified value, so
 * that declaration does not silently drop. Inline style keys ("--token":)
 * and setProperty("--token") count as declarations because they define the
 * property at runtime.
 *
 * Also fails on a non-zero border-radius with no unit (the browser drops it).
 * Zero is a valid unitless length.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { dirname, extname, join, relative } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["apps", "packages", "website/src"].map((dir) => join(root, dir));
const exts = new Set([".css", ".scss", ".tsx", ".ts", ".jsx", ".js"]);
const skip = new Set(["node_modules", "dist", "target", "coverage", ".next", "build"]);

function walk(dir, out = []) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const ent of entries) {
        if (skip.has(ent.name)) continue;
        const path = join(dir, ent.name);
        if (ent.isDirectory()) walk(path, out);
        else if (exts.has(extname(ent.name)) && statSync(path).isFile()) out.push(path);
    }
    return out;
}

function stripComments(text, ext) {
    const withoutBlock = text.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "));
    if (ext === ".css" || ext === ".scss") return withoutBlock;
    return withoutBlock.replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** @returns {{ name: string, hasFallback: boolean, index: number }[]} */
function findVarUses(text) {
    const uses = [];
    let i = 0;
    while ((i = text.indexOf("var(", i)) !== -1) {
        let depth = 1;
        let j = i + 4;
        let commaAtDepth1 = false;
        while (j < text.length && depth > 0) {
            const c = text[j];
            if (c === "(") depth++;
            else if (c === ")") depth--;
            else if (c === "," && depth === 1) commaAtDepth1 = true;
            if (depth === 0) break;
            j++;
        }
        const inner = text.slice(i + 4, j);
        const name = inner.match(/^\s*--([A-Za-z_][\w-]*)/);
        if (name) uses.push({ name: name[1], hasFallback: commaAtDepth1, index: i });
        i = j + 1;
    }
    return uses;
}

function lineOf(text, index) {
    let line = 1;
    for (let i = 0; i < index && i < text.length; i++) {
        if (text[i] === "\n") line++;
    }
    return line;
}

const defined = new Set();
/** @type {{ file: string, line: number, name: string }[]} */
const bareUses = [];
/** @type {{ file: string, line: number, text: string }[]} */
const unitlessRadius = [];

for (const dir of roots) {
    for (const file of walk(dir)) {
        const ext = extname(file);
        const raw = readFileSync(file, "utf8");
        const text = stripComments(raw, ext);
        const rel = relative(root, file);

        for (const m of text.matchAll(/(?:^|[^-\w])--([A-Za-z_][\w-]*)\s*:/g)) defined.add(m[1]);
        for (const m of text.matchAll(/["']--([A-Za-z_][\w-]*)["']\s*:/g)) defined.add(m[1]);
        for (const m of text.matchAll(/\[\s*["']--([A-Za-z_][\w-]*)["']/g)) defined.add(m[1]);
        for (const m of text.matchAll(/setProperty\(\s*["']--([A-Za-z_][\w-]*)/g)) defined.add(m[1]);

        for (const use of findVarUses(text)) {
            if (!use.hasFallback) bareUses.push({ file: rel, line: lineOf(text, use.index), name: use.name });
        }

        if (ext === ".css" || ext === ".scss") {
            for (const m of text.matchAll(/border-radius:\s*([^;{}]+)/g)) {
                const value = m[1];
                const bad = value.split(/[\s/]+/).some((part) => /^\d+(\.\d+)?$/.test(part) && Number(part) !== 0);
                if (bad) {
                    unitlessRadius.push({
                        file: rel,
                        line: lineOf(text, m.index),
                        text: `border-radius: ${value.trim()}`,
                    });
                }
            }
        }
    }
}

const missing = bareUses.filter((use) => !defined.has(use.name));
let failed = false;

if (missing.length > 0) {
    failed = true;
    const byName = new Map();
    for (const use of missing) {
        if (!byName.has(use.name)) byName.set(use.name, []);
        byName.get(use.name).push(use);
    }
    console.error(`[css] ${missing.length} var() use(s) of ${byName.size} undefined custom propert${byName.size === 1 ? "y" : "ies"} with no fallback:`);
    for (const [name, uses] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        console.error(`  --${name} (${uses.length})`);
        for (const use of uses.slice(0, 8)) console.error(`    ${use.file}:${use.line}`);
        if (uses.length > 8) console.error(`    … ${uses.length - 8} more`);
    }
}

if (unitlessRadius.length > 0) {
    failed = true;
    console.error(`[css] ${unitlessRadius.length} border-radius value(s) missing a unit (0 is allowed):`);
    for (const hit of unitlessRadius) console.error(`  ${hit.file}:${hit.line}  ${hit.text}`);
}

if (failed) process.exit(1);
console.log(`[css] custom properties ok (${defined.size} declared, ${bareUses.length} bare var() uses)`);
