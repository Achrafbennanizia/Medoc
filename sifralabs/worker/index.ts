/**
 * sifralabs.com Worker.
 * - POST /api/contact: validates a contact-form message and e-mails it to CONTACT_TO through
 *   Zoho's SMTP server (TLS, port 465), so messages only pass through Cloudflare and Zoho.
 * - Everything else: the static site in ./dist (wrangler.jsonc → assets).
 *
 * Secrets (Cloudflare → Worker → Settings → Variables and secrets):
 *   SMTP_USER      the Zoho mailbox, e.g. achraf.bennani@sifralabs.com
 *   SMTP_PASSWORD  a Zoho app-specific password (never the account password)
 * Plain variables (wrangler.jsonc → vars): SMTP_HOST, SMTP_PORT, CONTACT_TO, ALLOWED_ORIGINS.
 */
import { connect } from "cloudflare:sockets";

export interface Env {
  ASSETS: Fetcher;
  SMTP_HOST: string;
  SMTP_PORT: string;
  /** "on" for implicit TLS (Zoho, port 465); "off" only for local tests against a fake server. */
  SMTP_SECURE?: string;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
  CONTACT_TO: string;
  /** Comma-separated origins allowed to post (the MeDoc Dentist site lives on another origin). */
  ALLOWED_ORIGINS: string;
}

type Msg = {
  form: "sifra" | "medoc";
  name: string;
  email: string;
  phone: string;
  org: string;
  city: string;
  topic: string;
  message: string;
  lang: string;
  country: string;
};

const LIMITS: Record<keyof Msg, number> = {
  form: 10, name: 120, email: 200, phone: 40, org: 160, city: 80, topic: 80, message: 4000, lang: 10, country: 60,
};
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/api/contact") return env.ASSETS.fetch(request);

    const origin = request.headers.get("Origin") ?? "";
    const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    const cors: Record<string, string> = allowed.includes(origin)
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : {};
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: allowed.includes(origin) ? 204 : 403,
        headers: { ...cors, "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key", "Access-Control-Max-Age": "86400" },
      });
    }
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

    if (request.method !== "POST") return reply(405, { ok: false, error: "method" });
    // Only our own pages may post: a missing or foreign Origin is refused.
    if (!allowed.includes(origin)) return reply(403, { ok: false, error: "origin" });
    if (Number(request.headers.get("Content-Length") ?? "0") > 16_000) return reply(413, { ok: false, error: "size" });

    let raw: Record<string, unknown>;
    try {
      raw = (await request.json()) as Record<string, unknown>;
    } catch {
      return reply(400, { ok: false, error: "json" });
    }
    // Bot traps: a hidden field people never fill, and a minimum time on the page.
    if (typeof raw.website === "string" && raw.website !== "") return reply(200, { ok: true });
    if (typeof raw.elapsed === "number" && raw.elapsed < 3000) return reply(200, { ok: true });

    const msg = {} as Msg;
    for (const k of Object.keys(LIMITS) as (keyof Msg)[]) {
      const v = typeof raw[k] === "string" ? (raw[k] as string).trim() : "";
      if (v.length > LIMITS[k]) return reply(400, { ok: false, error: `too-long:${k}` });
      // Header fields must be single-line: this blocks e-mail header injection.
      (msg as Record<string, string>)[k] = k === "message" ? v : v.replace(/[\r\n]+/g, " ");
    }
    if (msg.form !== "sifra" && msg.form !== "medoc") return reply(400, { ok: false, error: "form" });
    if (!msg.name || !msg.email || !EMAIL_RE.test(msg.email)) return reply(400, { ok: false, error: "fields" });
    if (msg.form === "sifra" && !msg.message) return reply(400, { ok: false, error: "fields" });
    if (msg.form === "medoc" && (!msg.org || !msg.phone)) return reply(400, { ok: false, error: "fields" });

    // Idempotency: the same key within 10 minutes is answered without sending twice (double clicks, retries).
    const key = (request.headers.get("Idempotency-Key") ?? "").replace(/[^\w-]/g, "").slice(0, 64);
    const cacheKey = key ? new Request(`https://idempotency.sifralabs.internal/${key}`) : null;
    if (cacheKey && (await caches.default.match(cacheKey))) return reply(200, { ok: true, duplicate: true });

    try {
      await sendMail(env, compose(env, msg));
    } catch (err) {
      console.error("contact: send failed", err instanceof Error ? err.message : err);
      return reply(502, { ok: false, error: "send" });
    }
    if (cacheKey) ctx.waitUntil(caches.default.put(cacheKey, new Response("1", { headers: { "Cache-Control": "max-age=600" } })));
    return reply(200, { ok: true });
  },
};

/* ---------- message ---------- */
function compose(env: Env, m: Msg) {
  const product = m.form === "medoc" ? "MeDoc Dentist" : "Sifra Labs";
  const topic = m.form === "medoc" ? "Demo request" : m.topic || "Message";
  const where = [m.org, m.city].filter(Boolean).join(", ");
  const subject = [product, topic, where].filter(Boolean).join(" · ");
  const line = (label: string, v: string) => `${label}: ${v || "–"}`;
  const text = [
    `New message from the ${m.form === "medoc" ? "MeDoc Dentist" : "Sifra Labs"} website.`,
    "",
    "— Contact —",
    line("Name", m.name),
    line(m.form === "medoc" ? "Practice" : "Organisation", m.org),
    line("City", m.city),
    line("E-mail", m.email),
    line("Phone", m.phone),
    "",
    "— Request —",
    line("Topic", topic),
    "",
    m.message || "(no message)",
    "",
    "— Details —",
    line("Language", m.lang),
    line("Country", m.country),
    line("Received", new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC"),
    "",
    "Reply to this e-mail to answer the sender directly.",
  ].join("\r\n");
  return { from: env.SMTP_USER, to: env.CONTACT_TO, replyTo: m.email, replyName: m.name, subject, text };
}

/** RFC 2047 encoded-word for non-ASCII header text (names and subjects in Arabic, French…). */
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
function b64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/* ---------- minimal SMTP client (implicit TLS, AUTH LOGIN) ---------- */
async function sendMail(env: Env, mail: ReturnType<typeof compose>) {
  const socket = connect(
    { hostname: env.SMTP_HOST, port: Number(env.SMTP_PORT) },
    { secureTransport: env.SMTP_SECURE === "off" ? "off" : "on", allowHalfOpen: false },
  );
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let buf = "";

  // Reads one (possibly multi-line) reply and checks its code.
  const expect = async (code: number) => {
    for (;;) {
      const lines = buf.split("\r\n");
      const done = lines.findIndex((l) => /^\d{3} /.test(l));
      if (done >= 0) {
        buf = lines.slice(done + 1).join("\r\n");
        const got = Number(lines[done]!.slice(0, 3));
        if (got !== code) throw new Error(`SMTP ${got}: ${lines[done]!.slice(4, 120)}`);
        return;
      }
      const { value, done: closed } = await reader.read();
      if (closed) throw new Error("SMTP connection closed");
      buf += dec.decode(value, { stream: true });
    }
  };
  const send = (line: string) => writer.write(enc.encode(line + "\r\n"));

  const date = new Date().toUTCString().replace("GMT", "+0000");
  const id = `<${crypto.randomUUID()}@sifralabs.com>`;
  const body = mail.text
    .split("\r\n")
    .map((l) => (l.startsWith(".") ? "." + l : l)) // dot-stuffing
    .join("\r\n");
  const data = [
    `From: ${encodeHeader("Sifra Labs website")} <${mail.from}>`,
    `To: <${mail.to}>`,
    // The sender's name is always encoded, so characters like ":" or "<" can't bend the header.
    `Reply-To: =?UTF-8?B?${b64(mail.replyName)}?= <${mail.replyTo}>`,
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${id}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(body).replace(/.{76}/g, "$&\r\n"),
  ].join("\r\n");

  try {
    await expect(220);
    await send("EHLO sifralabs.com");
    await expect(250);
    await send("AUTH LOGIN");
    await expect(334);
    await send(b64(env.SMTP_USER));
    await expect(334);
    await send(b64(env.SMTP_PASSWORD));
    await expect(235);
    await send(`MAIL FROM:<${mail.from}>`);
    await expect(250);
    await send(`RCPT TO:<${mail.to}>`);
    await expect(250);
    await send("DATA");
    await expect(354);
    await send(data + "\r\n.");
    await expect(250);
    await send("QUIT");
  } finally {
    await socket.close().catch(() => {});
  }
}
