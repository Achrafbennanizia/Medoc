#!/usr/bin/env node
/**
 * Local stand-in for worker/index.ts POST /api/contact.
 * Same JSON contract; logs the message (production uses Cloudflare Email Sending).
 * Usage: node scripts/contact-dev-server.mjs
 * Env: .dev.vars (CONTACT_TO, ALLOWED_ORIGINS) or process env.
 */
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(root, ".dev.vars"))) {
  for (const line of readFileSync(join(root, ".dev.vars"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const PORT = Number(process.env.CONTACT_DEV_PORT || 8787);
const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;

function cors(origin) {
  return allowed.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || "";
  const headers = { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" };
  const reply = (status, body) => {
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  };

  if (req.url !== "/api/contact") return reply(404, { ok: false, error: "path" });
  if (req.method === "OPTIONS") {
    res.writeHead(allowed.includes(origin) ? 204 : 403, {
      ...cors(origin),
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }
  if (req.method !== "POST") return reply(405, { ok: false, error: "method" });
  if (!allowed.includes(origin)) return reply(403, { ok: false, error: "origin" });

  const chunks = [];
  for await (const c of req) chunks.push(c);
  let raw;
  try {
    raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply(400, { ok: false, error: "json" });
  }
  if (typeof raw.website === "string" && raw.website !== "") return reply(200, { ok: true });
  if (typeof raw.elapsed === "number" && raw.elapsed < 3000) return reply(200, { ok: true });

  const name = String(raw.name || "").trim().replace(/[\r\n]+/g, " ");
  const email = String(raw.email || "").trim().replace(/[\r\n]+/g, " ");
  const phone = String(raw.phone || "").trim().replace(/[\r\n]+/g, " ");
  const org = String(raw.org || "").trim().replace(/[\r\n]+/g, " ");
  const city = String(raw.city || "").trim().replace(/[\r\n]+/g, " ");
  const message = String(raw.message || "").trim();
  const form = String(raw.form || "").trim();
  const lang = String(raw.lang || "").trim().replace(/[\r\n]+/g, " ");

  if (form !== "sifra" && form !== "medoc") return reply(400, { ok: false, error: "form" });
  if (!name || !email || !EMAIL_RE.test(email)) return reply(400, { ok: false, error: "fields" });
  if (form === "medoc" && (!org || !phone)) return reply(400, { ok: false, error: "fields" });

  const where = [org, city].filter(Boolean).join(", ");
  const subject = ["MeDoc Dentist", "Demo request", where].filter(Boolean).join(" · ");
  console.log("contact (local stub → would Email Sending to", process.env.CONTACT_TO || "CONTACT_TO", ")");
  console.log({ subject, name, email, org, phone, city, lang, message: message.slice(0, 200) });
  return reply(200, { ok: true });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`contact-dev-server on http://127.0.0.1:${PORT}/api/contact`);
});
