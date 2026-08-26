import fs from "node:fs";

const reportPath = process.argv[2] ?? "axe-results.json";
const wcagTags = new Set(["wcag2a", "wcag2aa", "wcag21aa"]);

function collectReports(node) {
  if (Array.isArray(node)) {
    return node.flatMap((entry) => collectReports(entry));
  }
  if (!node || typeof node !== "object") {
    return [];
  }
  if (Array.isArray(node.violations)) {
    return [node];
  }
  if (Array.isArray(node.results)) {
    return node.results.flatMap((entry) => collectReports(entry));
  }
  return Object.values(node).flatMap((entry) => collectReports(entry));
}

const raw = fs.readFileSync(reportPath, "utf8");
const parsed = JSON.parse(raw);
const reports = collectReports(parsed);

const criticalViolations = [];
for (const report of reports) {
  for (const violation of report.violations ?? []) {
    const tags = Array.isArray(violation.tags) ? violation.tags : [];
    const matchesWcag = tags.some((tag) => wcagTags.has(tag));
    if (violation.impact === "critical" && matchesWcag) {
      criticalViolations.push({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        helpUrl: violation.helpUrl,
        nodes: Array.isArray(violation.nodes) ? violation.nodes.length : 0,
      });
    }
  }
}

if (criticalViolations.length > 0) {
  console.error(
    `Found ${criticalViolations.length} critical WCAG 2.x A/AA axe violation(s):`,
  );
  for (const violation of criticalViolations) {
    console.error(
      `- ${violation.id}: ${violation.description} (nodes: ${violation.nodes})`,
    );
    if (violation.helpUrl) {
      console.error(`  ${violation.helpUrl}`);
    }
  }
  process.exit(1);
}

console.log("No critical WCAG 2.x A/AA axe violations detected.");
