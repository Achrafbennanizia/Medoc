import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const FILE_EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);
const MATCHERS = [
    /\b(?:p|m)(?:[trblxy])?-\[[^\]]+\]/g,
    /\bgap-\[[^\]]+\]/g,
    /\bspace-[xy]-\[[^\]]+\]/g,
    /\b(?:w|h|min-w|max-w|min-h|max-h)-\[[^\]]+\]/g,
];

async function walk(dir, acc) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walk(full, acc);
            continue;
        }
        if (FILE_EXT.has(path.extname(entry.name))) {
            acc.push(full);
        }
    }
}

function lineNumberForIndex(source, index) {
    let line = 1;
    for (let i = 0; i < index; i += 1) {
        if (source[i] === "\n") line += 1;
    }
    return line;
}

async function main() {
    const files = [];
    await walk(ROOT, files);
    const findings = [];
    for (const file of files) {
        const raw = await readFile(file, "utf8");
        for (const matcher of MATCHERS) {
            matcher.lastIndex = 0;
            let hit = matcher.exec(raw);
            while (hit) {
                findings.push({
                    file: path.relative(process.cwd(), file),
                    line: lineNumberForIndex(raw, hit.index),
                    token: hit[0],
                });
                hit = matcher.exec(raw);
            }
        }
    }

    if (findings.length > 0) {
        console.error("Tailwind arbitrary spacing/value utilities are not allowed:");
        for (const finding of findings) {
            console.error(`- ${finding.file}:${finding.line} -> ${finding.token}`);
        }
        process.exit(1);
    }

    console.log("No arbitrary Tailwind spacing/size utilities found.");
}

await main();
