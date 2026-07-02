#!/usr/bin/env node
/**
 * Inject GitHub Releases updater endpoint + pubkey into tauri.conf.json before CI/local release builds.
 *
 * Env:
 *   MEDOC_UPDATER_GITHUB_REPO or GITHUB_REPOSITORY  — owner/repo
 *   TAURI_UPDATER_PUBKEY or MEDOC_TAURI_UPDATER_PUBKEY — minisign public key (safe to commit)
 *   TAURI_SIGNING_PRIVATE_KEY — when set, enables updater.active
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const confPath = join(root, "apps/practice-host/tauri.conf.json");
const conf = JSON.parse(readFileSync(confPath, "utf8"));

const repo = process.env.MEDOC_UPDATER_GITHUB_REPO || process.env.GITHUB_REPOSITORY || "";
const pubkey =
    process.env.TAURI_UPDATER_PUBKEY ||
    process.env.MEDOC_TAURI_UPDATER_PUBKEY ||
    conf.plugins?.updater?.pubkey ||
    "";

if (repo) {
    conf.plugins.updater.endpoints = [
        `https://github.com/${repo}/releases/latest/download/latest.json`,
    ];
}

if (pubkey && !pubkey.includes("REPLACE_WITH")) {
    conf.plugins.updater.pubkey = pubkey;
}

const signingKey = process.env.TAURI_SIGNING_PRIVATE_KEY || "";
conf.plugins.updater.active = Boolean(signingKey && pubkey && !pubkey.includes("REPLACE_WITH"));

writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`);
console.log(
    `[configure-tauri-updater] repo=${repo || "(unchanged)"} active=${conf.plugins.updater.active}`,
);
