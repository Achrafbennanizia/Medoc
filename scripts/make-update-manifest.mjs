#!/usr/bin/env node
/**
 * Writes the signed update manifest of one edition × flavor (editions plan §11.6, T7.5).
 *
 *   node scripts/make-update-manifest.mjs <tauri-latest.json> <edition> <flavor> > latest-<edition>-<flavor>.json
 *
 * Input: the Tauri updater manifest of that build (`merge-updater-latest.mjs`). Output: the same file with a
 * `medoc` block signed by the vendor Ed25519 key; the app refuses manifests without it
 * (`medoc-core::infrastructure::update_manifest`).
 *
 * Env:
 *   MEDOC_VENDOR_SIGNING_KEY   64 hex chars, the Ed25519 seed matching MEDOC_VENDOR_PUBKEY (CI secret; never logged)
 *   MEDOC_RELEASE_KIND         feature (default) | security
 *   MEDOC_RELEASE_CHANNEL      stable (default) | early
 *   MEDOC_MIN_SUPPORTED        oldest version that may install this one (default 0.0.0)
 *   MEDOC_SCHEMA_VERSION       database schema version (default 0)
 *   MEDOC_SYNC_PROTOCOL        sync protocol (default 2; keep equal to SYNC_PROTOCOL in update_manifest.rs)
 *   MEDOC_RELEASE_NOTES_DIR    folder with en.md, de.md, fr.md, ar.md (optional; falls back to the Tauri notes)
 */
import { createHash, createPrivateKey, sign } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Same bytes as `MedocBlock::signed_bytes` in Rust. */
export function signedBytes(b) {
    const h = createHash("sha256");
    for (const lang of Object.keys(b.notes).sort()) {
        h.update(Buffer.from(lang, "utf8"));
        h.update(Buffer.from([0]));
        h.update(Buffer.from(b.notes[lang], "utf8"));
        h.update(Buffer.from([0]));
    }
    const fields = [
        "medoc-update-v1",
        b.version,
        b.kind,
        b.minSupported,
        String(b.syncProtocol),
        String(b.schemaVersion),
        b.edition,
        b.flavor,
        b.channel,
        h.digest("hex"),
    ];
    return Buffer.from(fields.join("|"), "utf8");
}

/** Ed25519 signature, base64 without padding (as `verify_ed25519` expects). */
export function signBlock(b, seedHex) {
    if (!/^[0-9a-fA-F]{64}$/.test(seedHex)) throw new Error("MEDOC_VENDOR_SIGNING_KEY must be 64 hex chars");
    const pkcs8 = Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(seedHex, "hex")]);
    const key = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });
    return sign(null, signedBytes(b), key).toString("base64").replace(/=+$/, "");
}

const EDITIONS = ["solo", "duo", "group"];
const FLAVORS = ["main", "replica"];

function main() {
    const [input, edition, flavor] = process.argv.slice(2);
    if (!input || !EDITIONS.includes(edition) || !FLAVORS.includes(flavor)) {
        console.error("Usage: make-update-manifest.mjs <tauri-latest.json> <solo|duo|group> <main|replica>");
        process.exit(1);
    }
    if (edition === "solo" && flavor === "replica") throw new Error("Solo has no replica flavor");
    const seed = process.env.MEDOC_VENDOR_SIGNING_KEY || "";
    const tauri = JSON.parse(readFileSync(input, "utf8"));
    const version = String(tauri.version || "").replace(/^v/, "");
    if (!version) throw new Error("Tauri manifest has no version");
    const notes = {};
    const dir = process.env.MEDOC_RELEASE_NOTES_DIR;
    for (const lang of ["en", "de", "fr", "ar"]) {
        const file = dir ? join(dir, `${lang}.md`) : "";
        if (file && existsSync(file)) notes[lang] = readFileSync(file, "utf8").trim();
    }
    if (!notes.en) notes.en = String(tauri.notes || "MeDoc release");
    const kind = process.env.MEDOC_RELEASE_KIND === "security" ? "security" : "feature";
    const channel = process.env.MEDOC_RELEASE_CHANNEL === "early" ? "early" : "stable";
    const block = {
        version,
        kind,
        minSupported: process.env.MEDOC_MIN_SUPPORTED || "0.0.0",
        syncProtocol: Number(process.env.MEDOC_SYNC_PROTOCOL || 2),
        schemaVersion: Number(process.env.MEDOC_SCHEMA_VERSION || 0),
        edition,
        flavor,
        channel,
        notes,
    };
    block.signature = signBlock(block, seed);
    process.stdout.write(`${JSON.stringify({ ...tauri, medoc: block }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
