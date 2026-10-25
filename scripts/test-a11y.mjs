import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import axe from "axe-core";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "apps", "practice-host-ui", "dist");

const WCAG_TAGS = ["wcag2a", "wcag2aa"];

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".woff")) return "font/woff";
  if (filePath.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

async function resolveRequestPath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split("?")[0] || "/");
  const candidatePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const normalized = path.normalize(path.join(distDir, candidatePath));

  if (!normalized.startsWith(distDir)) {
    return null;
  }

  try {
    const candidateStat = await stat(normalized);
    if (candidateStat.isDirectory()) {
      return path.join(normalized, "index.html");
    }
    return normalized;
  } catch {
    // SPA fallback so client-side routes can still be scanned.
    return path.join(distDir, "index.html");
  }
}

async function startServer() {
  await stat(path.join(distDir, "index.html"));

  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const resolved = await resolveRequestPath(req.url || "/");
      if (!resolved) {
        res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Forbidden");
        return;
      }

      try {
        const fileBuffer = await readFile(resolved);
        res.writeHead(200, { "Content-Type": contentType(resolved) });
        res.end(fileBuffer);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not Found");
      }
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to determine local server port for a11y scan."));
        return;
      }
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function printCriticalViolations(violations) {
  for (const violation of violations) {
    console.error(`\n[critical] ${violation.id}: ${violation.help}`);
    console.error(`Impact: ${violation.impact ?? "unknown"}`);
    console.error(`Help URL: ${violation.helpUrl}`);

    for (const node of violation.nodes) {
      const target = node.target?.join(" ") || "(no target)";
      console.error(`  - target: ${target}`);
      if (node.failureSummary) {
        console.error(`    ${node.failureSummary.trim()}`);
      }
    }
  }
}

async function run() {
  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle" });
    await page.addScriptTag({ content: axe.source });

    const results = await page.evaluate(async (tags) => {
      return window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: tags,
        },
      });
    }, WCAG_TAGS);

    const criticalViolations = results.violations.filter(
      (violation) => violation.impact === "critical",
    );

    if (criticalViolations.length > 0) {
      console.error(
        `Critical WCAG 2.1 A/AA violations found: ${criticalViolations.length}`,
      );
      printCriticalViolations(criticalViolations);
      process.exitCode = 1;
      return;
    }

    console.log(
      `axe-core scan passed: 0 critical WCAG 2.1 A/AA violations (total violations: ${results.violations.length}).`,
    );
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

run().catch((error) => {
  console.error(`a11y scan failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
