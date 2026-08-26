import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "@playwright/test";

const HOST = "127.0.0.1";
const PORT = "4173";
const URL = `http://${HOST}:${PORT}`;
const REPORT_PATH = "a11y-report.json";
const require = createRequire(import.meta.url);
const AXE_SOURCE_PATH = require.resolve("axe-core/axe.min.js");

function waitForPreviewReady(previewProcess, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error(`Timed out waiting for preview server at ${URL}`));
      }
    }, timeoutMs);

    const onChunk = (chunk, writer) => {
      const text = chunk.toString();
      writer.write(text);
      if (!done && text.includes(`${HOST}:${PORT}`)) {
        done = true;
        clearTimeout(timer);
        resolve();
      }
    };

    previewProcess.stdout?.on("data", (chunk) => onChunk(chunk, process.stdout));
    previewProcess.stderr?.on("data", (chunk) => onChunk(chunk, process.stderr));
    previewProcess.on("error", (error) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(error);
      }
    });
    previewProcess.on("close", (code) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(new Error(`Preview process exited before ready (code ${code})`));
      }
    });
  });
}

let previewProcess;
let browser;
try {
  previewProcess = spawn(
    "npm",
    ["run", "preview", "--", "--host", HOST, "--port", PORT],
    { stdio: ["ignore", "pipe", "pipe"], detached: true },
  );

  await waitForPreviewReady(previewProcess);

  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  } catch {
    browser = await chromium.launch({ headless: true });
  }

  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  const axeSource = await readFile(AXE_SOURCE_PATH, "utf8");
  await page.addScriptTag({ content: axeSource });

  const reportData = await page.evaluate(async () => {
    return window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2aa", "wcag21aa"] },
    });
  });

  await writeFile(REPORT_PATH, `${JSON.stringify(reportData, null, 2)}\n`, "utf8");

  const violations = (reportData.violations ?? []).filter(
    (violation) => violation.impact === "critical",
  );

  if (violations.length > 0) {
    console.error("Critical WCAG 2.1 AA violations found:");
    for (const violation of violations) {
      console.error(
        `- ${violation.id}: ${violation.help} (impact=${violation.impact}, nodes=${violation.nodes})`,
      );
    }
    process.exit(1);
  }

  console.log("No critical WCAG 2.1 AA violations detected.");
} finally {
  if (browser) {
    await browser.close();
  }
  if (previewProcess?.pid) {
    try {
      process.kill(-previewProcess.pid, "SIGTERM");
      await sleep(1000);
      process.kill(-previewProcess.pid, "SIGKILL");
    } catch {
      // process group already terminated
    }
  }
}
