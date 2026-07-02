#!/usr/bin/env node
/**
 * Merge per-platform Tauri updater JSON files into one latest.json for GitHub Releases.
 * Usage: node scripts/merge-updater-latest.mjs <artifact-root> > latest.json
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2];
if (!root) {
    console.error("Usage: merge-updater-latest.mjs <artifact-root>");
    process.exit(1);
}

function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) walk(p, out);
        else out.push(p);
    }
    return out;
}

const merged = {
    version: "",
    notes: "MeDoc release",
    pub_date: new Date().toISOString(),
    platforms: {},
};

for (const file of walk(root)) {
    if (!file.endsWith(".json")) continue;
    if (file.endsWith("latest.json")) continue;
    let data;
    try {
        data = JSON.parse(readFileSync(file, "utf8"));
    } catch {
        continue;
    }
    if (!data.platforms || typeof data.platforms !== "object") continue;
    if (!merged.version && data.version) merged.version = data.version;
    if (data.notes) merged.notes = data.notes;
    if (data.pub_date) merged.pub_date = data.pub_date;
    Object.assign(merged.platforms, data.platforms);
}

if (!merged.version) {
    console.error("No updater platform manifests found under", root);
    process.exit(1);
}

process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
