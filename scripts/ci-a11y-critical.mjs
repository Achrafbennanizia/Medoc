import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const distDir = path.join(repoRoot, "apps", "practice-host-ui", "dist");
const indexPath = path.join(distDir, "index.html");
const host = "127.0.0.1";
const port = Number(process.env.MEDOC_A11Y_PORT || 4173);

if (!existsSync(indexPath)) {
  console.error(`Built UI not found at ${indexPath}. Run build before test:a11y.`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const axeSourcePath = require.resolve("axe-core/axe.min.js");
const axeSource = await readFile(axeSourcePath, "utf8");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sanitizeRequestPath(rawPath) {
  const clean = decodeURIComponent(rawPath.split("?")[0]).replace(/^\/+/, "");
  return clean || "index.html";
}

function resolveContentType(filePath) {
  return mimeTypes[path.extname(filePath)] || "application/octet-stream";
}

const server = createServer(async (req, res) => {
  try {
    const requested = sanitizeRequestPath(req.url || "/");
    let resolved = path.resolve(distDir, requested);
    if (!resolved.startsWith(distDir)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    let filePath = resolved;
    try {
      const info = await stat(resolved);
      if (info.isDirectory()) {
        filePath = path.join(resolved, "index.html");
      }
    } catch {
      filePath = indexPath;
    }

    const info = await stat(filePath);
    if (!info.isFile()) {
      throw new Error("Not a file");
    }

    res.writeHead(200, { "Content-Type": resolveContentType(filePath) });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404).end("Not Found");
  }
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, host, () => resolve());
});

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto(`http://${host}:${port}`, { waitUntil: "networkidle" });
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => {
    return window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2aa", "wcag21aa"] },
    });
  });

  const criticalViolations = (results.violations || []).filter(
    (violation) => violation.impact === "critical",
  );

  if (criticalViolations.length > 0) {
    console.error("Critical WCAG 2.1 AA violations detected:");
    for (const violation of criticalViolations) {
      console.error(`- ${violation.id}: ${violation.help}`);
      for (const node of violation.nodes.slice(0, 5)) {
        console.error(`  selector: ${node.target.join(", ")}`);
      }
    }
    process.exitCode = 1;
  } else {
    console.log("No critical WCAG 2.1 AA violations detected.");
  }
} finally {
  if (browser) {
    await browser.close();
  }
  await new Promise((resolve) => server.close(() => resolve()));
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
