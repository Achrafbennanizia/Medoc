#!/usr/bin/env node

import fs from "node:fs";

const reportPath = process.argv[2] ?? "axe-results.json";

if (!fs.existsSync(reportPath)) {
  console.error(`axe-core report not found: ${reportPath}`);
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(reportPath, "utf8"));
} catch (error) {
  console.error(`Failed to parse axe-core report (${reportPath}):`, error);
  process.exit(1);
}

const scans = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed.results)
    ? parsed.results
    : [parsed];

const criticalFindings = [];
for (const scan of scans) {
  const url = scan.url ?? scan.pageUrl ?? "unknown-url";
  const violations = Array.isArray(scan.violations) ? scan.violations : [];
  for (const violation of violations) {
    const nodes = Array.isArray(violation.nodes) ? violation.nodes : [];
    const hasCriticalNode = nodes.some((node) => node.impact === "critical");
    if (violation.impact === "critical" || hasCriticalNode) {
      criticalFindings.push({
        url,
        id: violation.id ?? "unknown-rule",
        help: violation.help ?? "no description",
        nodeCount: nodes.length,
      });
    }
  }
}

if (criticalFindings.length > 0) {
  console.error(
    `Found ${criticalFindings.length} critical axe-core violation(s):`,
  );
  for (const finding of criticalFindings) {
    console.error(
      `- [${finding.url}] ${finding.id}: ${finding.help} (nodes=${finding.nodeCount})`,
    );
  }
  process.exit(1);
}

console.log("No critical axe-core violations found.");
