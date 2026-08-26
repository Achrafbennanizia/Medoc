import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const roots = [
    path.resolve(process.cwd(), "src"),
    path.resolve(process.cwd(), "../../packages"),
];

const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".html"]);

const spacingUtility =
    "(?:m[trblxyse]?|p[trblxyse]?|gap(?:-[xy])?|space-[xy]|w|min-w|max-w|h|min-h|max-h|inset(?:-[xy])?|top|right|bottom|left|z)";
const arbitrarySpacingToken = new RegExp(
    `\\b(?:[\\w-]+:)*${spacingUtility}-\\[[^\\]]+\\]`,
    "g",
);

/**
 * Recursively walks files from `dir` and yields source files.
 */
function* walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const next = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "coverage") {
                continue;
            }
            yield* walk(next);
            continue;
        }
        if (!allowedExtensions.has(path.extname(entry.name))) {
            continue;
        }
        yield next;
    }
}

const findings = [];

for (const root of roots) {
    for (const filePath of walk(root)) {
        const text = fs.readFileSync(filePath, "utf8");
        const lines = text.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            const matches = line.match(arbitrarySpacingToken);
            if (!matches) continue;
            for (const token of matches) {
                findings.push({
                    file: path.relative(process.cwd(), filePath),
                    line: i + 1,
                    token,
                });
            }
        }
    }
}

if (findings.length > 0) {
    console.error("Arbitrary spacing/size/z-index Tailwind tokens are disallowed:");
    for (const finding of findings) {
        console.error(`- ${finding.file}:${finding.line} -> ${finding.token}`);
    }
    process.exit(1);
}

console.log("Tailwind arbitrary spacing token lint passed (no violations).");
