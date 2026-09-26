import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import axe from "axe-core";
import { JSDOM } from "jsdom";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const distIndexHtml = path.join(packageRoot, "dist", "index.html");

let html;
try {
  html = readFileSync(distIndexHtml, "utf8");
} catch (error) {
  console.error(`Missing built UI artifact: ${distIndexHtml}`);
  console.error("Run the build step before test:a11y.");
  throw error;
}

const dom = new JSDOM(html, {
  runScripts: "outside-only",
  url: "http://localhost/",
});

dom.window.eval(axe.source);

const results = await dom.window.axe.run(dom.window.document, {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa"],
  },
});

const criticalViolations = results.violations.filter(
  (violation) => violation.impact === "critical",
);

if (criticalViolations.length > 0) {
  console.error(
    `Found ${criticalViolations.length} critical WCAG 2.1 A/AA violation(s).`,
  );
  for (const violation of criticalViolations) {
    console.error(`- [${violation.id}] ${violation.help}`);
    for (const node of violation.nodes) {
      console.error(`  target: ${node.target.join(", ")}`);
    }
  }
  process.exit(1);
}

console.log(
  `A11y check passed: ${results.violations.length} total violations, 0 critical.`,
);
