import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import axe from "axe-core";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = path.resolve(scriptDir, "..", "dist", "index.html");

async function run() {
    let html;
    try {
        html = await fs.readFile(indexHtmlPath, "utf8");
    } catch (error) {
        console.error(`Missing build artifact: ${indexHtmlPath}`);
        console.error("Run `npm run build` before `npm run test:a11y`.");
        throw error;
    }

    const dom = new JSDOM(html, {
        runScripts: "outside-only",
        url: "http://localhost/",
    });
    const { window } = dom;
    window.eval(axe.source);

    const results = await window.axe.run(window.document, {
        runOnly: {
            type: "tag",
            values: ["wcag2aa"],
        },
    });

    const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");
    if (criticalViolations.length > 0) {
        console.error(`Found ${criticalViolations.length} critical WCAG 2.1 AA violation(s).`);
        for (const violation of criticalViolations) {
            console.error(`\n[${violation.id}] ${violation.help}`);
            console.error(`Help: ${violation.helpUrl}`);
            for (const node of violation.nodes) {
                console.error(`- ${node.target.join(", ")} :: ${node.failureSummary ?? "No summary provided."}`);
            }
        }
        process.exit(1);
    }

    console.log(`A11y scan complete. Total violations: ${results.violations.length}; critical: 0.`);
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
