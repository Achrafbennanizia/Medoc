#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_URL = "http://127.0.0.1:4173";
const targetUrl = process.env.MEDOC_A11Y_URL || DEFAULT_URL;
const reportDir = mkdtempSync(join(tmpdir(), "medoc-axe-"));
const reportPath = join(reportDir, "axe-results.json");

const preview = spawn(
  "npm",
  ["run", "preview", "-w", "medoc", "--", "--host", "127.0.0.1", "--port", "4173"],
  { stdio: "inherit" },
);

let previewExitCode = null;
preview.on("exit", (code) => {
  previewExitCode = code ?? 0;
});

const shutdownPreview = () => {
  if (!preview.killed) {
    preview.kill("SIGTERM");
  }
};

process.on("SIGINT", shutdownPreview);
process.on("SIGTERM", shutdownPreview);

const waitForPreview = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (previewExitCode !== null && previewExitCode !== 0) {
      throw new Error(`Preview server exited early with code ${previewExitCode}`);
    }
    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the preview server comes up.
    }
    await delay(1000);
  }
  throw new Error(`Timed out waiting for preview server at ${targetUrl}`);
};

const parseViolations = (payload) => {
  const records = Array.isArray(payload) ? payload : [payload];
  return records.flatMap((record) => {
    if (Array.isArray(record?.violations)) {
      return record.violations;
    }
    if (Array.isArray(record?.results?.violations)) {
      return record.results.violations;
    }
    return [];
  });
};

try {
  await waitForPreview();

  const axeResult = spawnSync(
    "npx",
    ["--yes", "@axe-core/cli", targetUrl, "--tags", "wcag2a,wcag2aa", "--save", reportPath],
    { stdio: "inherit" },
  );

  if (!existsSync(reportPath)) {
    throw new Error(
      `axe-core did not produce a report (exit=${axeResult.status ?? "unknown"}).`,
    );
  }

  const payload = JSON.parse(readFileSync(reportPath, "utf8"));
  const violations = parseViolations(payload);
  const criticalViolations = violations.filter((violation) => violation?.impact === "critical");

  if (criticalViolations.length > 0) {
    console.error(
      `Critical WCAG 2.1 A/AA violations found: ${criticalViolations.length}`,
    );
    for (const violation of criticalViolations) {
      console.error(
        `- ${violation.id}: ${violation.help ?? "no help text"} (${violation.nodes?.length ?? 0} nodes)`,
      );
    }
    process.exitCode = 1;
  } else {
    console.log(
      `axe-core scan complete: ${violations.length} total violations, 0 critical WCAG 2.1 A/AA violations.`,
    );
  }
} finally {
  shutdownPreview();
  rmSync(reportDir, { recursive: true, force: true });
}
