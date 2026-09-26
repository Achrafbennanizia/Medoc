import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import * as ts from "typescript";
import { describe, expect, it } from "vitest";

function walk(dir: string, files: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const absolute = path.join(dir, entry);
        const stat = statSync(absolute);
        if (stat.isDirectory()) {
            walk(absolute, files);
            continue;
        }
        if (absolute.endsWith(".tsx")) files.push(absolute);
    }
    return files;
}

describe("icon button accessibility policy", () => {
    it("requires aria-label or aria-labelledby on raw icon-btn buttons", () => {
        const files = walk(path.resolve(process.cwd(), "src/views"));

        const missing: Array<{ file: string; tag: string }> = [];

        for (const file of files) {
            if (file.endsWith(`${path.sep}icon-button.tsx`)) {
                // This helper enforces aria-label at the type level (IconButtonProps).
                continue;
            }
            const source = readFileSync(file, "utf8");
            const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

            const visit = (node: ts.Node) => {
                if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
                    const tagName = node.tagName.getText(sourceFile);
                    if (tagName === "button") {
                        const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
                        const classAttr = attrs.find((attr) => attr.name.text === "className");
                        const hasIconClass = classAttr?.initializer?.getText(sourceFile).includes("icon-btn") ?? false;
                        if (hasIconClass) {
                            const hasLabel = attrs.some(
                                (attr) =>
                                    attr.name.text === "aria-label" || attr.name.text === "aria-labelledby",
                            );
                            if (!hasLabel) {
                                missing.push({
                                    file: path.relative(process.cwd(), file),
                                    tag: node.getText(sourceFile).replace(/\s+/g, " ").trim(),
                                });
                            }
                        }
                    }
                }
                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        if (missing.length > 0) {
            for (const item of missing) {
                // Helpful debug output in CI failures.
                // eslint-disable-next-line no-console
                console.error(`${item.file}: ${item.tag}`);
            }
        }

        expect(missing).toEqual([]);
    });
});
