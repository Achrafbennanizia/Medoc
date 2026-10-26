#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const host = process.env.A11Y_HOST ?? "127.0.0.1";
const port = Number(process.env.A11Y_PORT ?? "4173");
const timeoutMs = Number(process.env.A11Y_TIMEOUT_MS ?? "45000");
const targetUrl = process.env.A11Y_URL ?? `http://${host}:${port}/`;

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const preview = spawn(
  npmCommand,
  ["run", "preview", "-w", "medoc", "--", "--host", host, "--port", String(port), "--strictPort"],
  { stdio: "inherit", env: process.env },
);

let previewExited = false;
let previewExitCode = null;

preview.on("exit", (code) => {
  previewExited = true;
  previewExitCode = code;
});

async function waitForPreview(url, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (previewExited) {
      throw new Error(`preview server exited before scan (exit code ${previewExitCode ?? "unknown"})`);
    }

    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
    } catch {
      // keep polling until timeout
    }

    await delay(500);
  }

  throw new Error(`preview server was not reachable at ${url} within ${timeout}ms`);
}

async function stopPreview() {
  if (previewExited) {
    return;
  }

  preview.kill("SIGTERM");
  await delay(1500);

  if (!previewExited) {
    preview.kill("SIGKILL");
  }
}

let browser;

try {
  await waitForPreview(targetUrl, timeoutMs);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(targetUrl, { waitUntil: "networkidle" });

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const criticalViolations = results.violations.filter((violation) => violation.impact === "critical");

  if (criticalViolations.length > 0) {
    console.error(`Found ${criticalViolations.length} critical WCAG 2.1 A/AA violation(s).`);
    for (const violation of criticalViolations) {
      console.error(`- ${violation.id}: ${violation.help}`);
      for (const node of violation.nodes) {
        console.error(`  selector: ${node.target.join(", ")}`);
      }
    }
    process.exitCode = 1;
  } else {
    console.log("No critical WCAG 2.1 A/AA violations found.");
    if (results.violations.length > 0) {
      console.log(`Non-critical violations detected: ${results.violations.length} (reported, not gating).`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
  await stopPreview();
}
