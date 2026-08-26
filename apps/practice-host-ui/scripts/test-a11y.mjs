import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import axe from "axe-core";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(scriptDir, "../dist/index.html");

let html;
try {
    html = await readFile(indexPath, "utf8");
} catch (error) {
    console.error(`Unable to read built UI at ${indexPath}. Run the build step before test:a11y.`);
    throw error;
}

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost" });
dom.window.eval(axe.source);

const results = await dom.window.axe.run(dom.window.document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
});
const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");

if (criticalViolations.length > 0) {
    console.error("Critical WCAG 2.1 AA violations detected:");
    for (const violation of criticalViolations) {
        const nodes = violation.nodes.map((node) => node.target.join(" ")).join("; ");
        console.error(`- ${violation.id}: ${violation.help} [targets: ${nodes}]`);
    }
    process.exit(1);
}

console.log("A11y check passed: no critical WCAG 2.1 AA violations detected.");
