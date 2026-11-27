#!/usr/bin/env node
/**
 * Build MeDoc Dentist (../website, npm workspace "medoc-dentist") into this site's
 * dist/products/medoc-dentist/, so it is served from the company domain.
 * Run after `npm run build` (see `npm run build:all`).
 *
 * Env: SITE_BASE (e.g. /Medoc on GitHub Pages, empty on sifralabs.com), SITE_ORIGIN,
 * VITE_CONTACT_API, VITE_TURNSTILE_SITE_KEY. Same names the company build reads.
 */
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const site = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(site, "..");
const PATH = "products/medoc-dentist";
const out = join(site, "dist", PATH);

const env = {
  ...process.env,
  PRODUCT_BASE: `${process.env.SITE_BASE || ""}/${PATH}/`,
  SITE_ORIGIN: process.env.SITE_ORIGIN || "https://sifralabs.com",
};
const run = (cmd) => execSync(cmd, { cwd: repo, env, stdio: "inherit" });

// Cloudflare only installs sifralabs/; install just the product workspace when it is missing.
if (!existsSync(join(repo, "node_modules", "vite")) || !existsSync(join(repo, "node_modules", "react"))) {
  run("npm ci --workspace medoc-dentist --no-audit --no-fund");
}
run("npm run build -w medoc-dentist");

if (!existsSync(join(site, "dist", "index.html"))) throw new Error("Build the company site first (npm run build).");
rmSync(out, { recursive: true, force: true });
cpSync(join(repo, "website", "dist"), out, { recursive: true });
console.log(`MeDoc Dentist → dist/${PATH}/ (base ${env.PRODUCT_BASE})`);
