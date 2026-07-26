import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

const HOST = "127.0.0.1";
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;
const MAX_WAIT_MS = 60_000;
const require = createRequire(import.meta.url);

function startPreviewServer() {
  return spawn(
    "npm",
    ["run", "preview", "--", "--host", HOST, "--port", String(PORT), "--strictPort"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    },
  );
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // preview server is still starting
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for preview server at ${url}`);
}

function summarizeCriticalViolations(violations) {
  for (const violation of violations) {
    console.error(`- [${violation.id}] ${violation.help}`);
    for (const node of violation.nodes) {
      console.error(`  selector: ${node.target.join(" ")}`);
      if (node.failureSummary) {
        console.error(`  ${node.failureSummary.replace(/\n/g, "\n  ")}`);
      }
    }
  }
}

async function run() {
  if (!existsSync("dist/index.html")) {
    throw new Error("Missing dist/index.html. Run the build step before test:a11y.");
  }

  const axeSourcePath = require.resolve("axe-core/axe.min.js");
  const axeSource = readFileSync(axeSourcePath, "utf8");

  const preview = startPreviewServer();
  let stdout = "";
  let stderr = "";
  preview.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  preview.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer(BASE_URL, MAX_WAIT_MS);

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.addScriptTag({ content: axeSource });

      const results = await page.evaluate(async () => {
        return window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa"],
          },
        });
      });

      const criticalViolations = results.violations.filter(
        (violation) => violation.impact === "critical",
      );

      if (criticalViolations.length > 0) {
        console.error(
          `Found ${criticalViolations.length} critical WCAG 2.1 (A/AA) accessibility violation(s).`,
        );
        summarizeCriticalViolations(criticalViolations);
        process.exitCode = 1;
      } else {
        console.log("No critical WCAG 2.1 A/AA accessibility violations found.");
      }
    } finally {
      await browser.close();
    }
  } finally {
    preview.kill("SIGTERM");
    await delay(500);
    if (!preview.killed) {
      preview.kill("SIGKILL");
    }
    if (process.exitCode && process.exitCode !== 0) {
      if (stdout.trim()) {
        console.error(stdout.trim());
      }
      if (stderr.trim()) {
        console.error(stderr.trim());
      }
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
