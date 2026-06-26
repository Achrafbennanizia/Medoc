import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import axe from "axe-core";

const distHtmlPath = resolve(process.cwd(), "dist", "index.html");

let html;
try {
    html = await readFile(distHtmlPath, "utf8");
} catch (error) {
    console.error(`Failed to read built UI at ${distHtmlPath}. Run the build first.`);
    console.error(error);
    process.exit(1);
}

const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "http://localhost/",
    pretendToBeVisual: true
});

dom.window.eval(axe.source);

const results = await dom.window.axe.run(dom.window.document, {
    runOnly: {
        type: "tag",
        values: ["wcag2aa"]
    }
});

const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");

if (criticalViolations.length > 0) {
    console.error(`Found ${criticalViolations.length} critical WCAG 2.1 AA violations.`);
    for (const violation of criticalViolations) {
        console.error(`- ${violation.id}: ${violation.help}`);
        for (const node of violation.nodes) {
            console.error(`  • ${node.target.join(", ")}`);
        }
    }
    process.exit(1);
}

console.log(`A11y check passed (critical WCAG 2.1 AA violations: ${criticalViolations.length}).`);
