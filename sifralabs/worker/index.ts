/**
 * sifralabs.com Worker.
 * - POST /api/contact: Turnstile + checks → Email Sending → CONTACT_TO (Free plan: verified destinations only).
 * - GET  /api/contact/confirm?token=…: legacy one-time links still in KV (no new tokens minted).
 * - Everything else: static site in ./dist.
 *
 * Secrets: TURNSTILE_SECRET_KEY (wrangler secret).
 * shortcut: skip visitor double opt-in — Free Email Sending cannot mail arbitrary addresses; upgrade Workers Paid to restore.
 */
export interface Env {
  ASSETS: Fetcher;
  EMAIL: SendEmail;
  /** Confirm-token store (wrangler.jsonc → kv_namespaces binding PENDING). */
  PENDING: KVNamespace;
  CONTACT_FROM: string;
  CONTACT_TO: string;
  ALLOWED_ORIGINS: string;
  /** Empty in local preview → Turnstile check skipped. Set in production. */
  TURNSTILE_SECRET_KEY?: string;
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
const LANGS = new Set(["en", "fr", "ar"]);
const MIN_ELAPSED_MS = 4_000;
const RATE_PER_HOUR = 20;
const PENDING_TTL = 86_400; // 24 h

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/contact/confirm") return confirm(request, env, ctx, url);
    if (url.pathname !== "/api/contact") return env.ASSETS.fetch(request);

    const origin = request.headers.get("Origin") ?? "";
    const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
    const cors: Record<string, string> = allowed.includes(origin)
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : {};
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: allowed.includes(origin) ? 204 : 403,
        headers: {
          ...cors,
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Idempotency-Key",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    const reply = (status: number, body: object) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });

    if (request.method !== "POST") return reply(405, { ok: false, error: "method" });
    if (!allowed.includes(origin)) return reply(403, { ok: false, error: "origin" });
    const ctype = (request.headers.get("Content-Type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (ctype !== "application/json") return reply(415, { ok: false, error: "type" });
    if (Number(request.headers.get("Content-Length") ?? "0") > 16_000) return reply(413, { ok: false, error: "size" });

    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
    if (!(await rateOk(ip))) return reply(429, { ok: false, error: "rate" });

    let raw: Record<string, unknown>;
    try {
      raw = (await request.json()) as Record<string, unknown>;
    } catch {
      return reply(400, { ok: false, error: "json" });
    }

    // Bot traps: honeypot + minimum time on the form.
    if (typeof raw.website === "string" && raw.website !== "") return reply(200, { ok: true, pending: true });
    if (typeof raw.elapsed !== "number" || raw.elapsed < MIN_ELAPSED_MS) return reply(200, { ok: true, pending: true });

    // Widget hidden input is cf-turnstile-response; JSON may use turnstile / turnstileToken.
    const turnstile = String(raw.turnstile ?? raw["cf-turnstile-response"] ?? raw.turnstileToken ?? "").trim();
    if (!(await verifyTurnstile(env, turnstile, ip))) return reply(403, { ok: false, error: "turnstile" });

    const msg = {} as Msg;
    for (const k of Object.keys(LIMITS) as (keyof Msg)[]) {
      const v = typeof raw[k] === "string" ? (raw[k] as string).trim() : "";
      if (v.length > LIMITS[k]) return reply(400, { ok: false, error: `too-long:${k}` });
      (msg as Record<string, string>)[k] = k === "message" ? v : v.replace(/[\r\n]+/g, " ");
    }
    if (msg.form !== "sifra" && msg.form !== "medoc") return reply(400, { ok: false, error: "form" });
    if (!LANGS.has(msg.lang)) msg.lang = "en";
    if (!msg.name || !msg.email || !EMAIL_RE.test(msg.email)) return reply(400, { ok: false, error: "fields" });
    if (/https?:\/\//i.test(msg.name) || !/\p{L}{2,}/u.test(msg.name)) return reply(400, { ok: false, error: "fields" });
    if (msg.form === "sifra" && !msg.message) return reply(400, { ok: false, error: "fields" });
    if (msg.form === "medoc" && (!msg.org || !msg.phone || digitCount(msg.phone) < 8)) return reply(400, { ok: false, error: "fields" });
    if (urlCount(msg.message) > 2) return reply(400, { ok: false, error: "fields" });

    const key = (request.headers.get("Idempotency-Key") ?? "").replace(/[^\w-]/g, "").slice(0, 64);
    if (key.length < 16) return reply(400, { ok: false, error: "idempotency" });
    const idemKey = new Request(`https://idempotency.sifralabs.internal/${key}`);
    if (await caches.default.match(idemKey)) return reply(200, { ok: true, duplicate: true });

    try {
      await env.EMAIL.send(composeInbox(env, msg));
    } catch (err) {
      console.error("contact: inbox mail failed", err instanceof Error ? err.message : err);
      return reply(502, { ok: false, error: "send" });
    }

    ctx.waitUntil(caches.default.put(idemKey, new Response("1", { headers: { "Cache-Control": "max-age=600" } })));
    return reply(200, { ok: true });
  },
};

/* ---------- confirm link ---------- */
async function confirm(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const token = (url.searchParams.get("token") ?? "").replace(/[^a-f0-9]/gi, "").slice(0, 64);
  if (token.length < 32) return htmlPage(400, "en", "invalid");

  const raw = await env.PENDING.get(token);
  if (!raw) return htmlPage(410, "en", "expired");

  let msg: Msg;
  try {
    msg = JSON.parse(raw) as Msg;
  } catch {
    return htmlPage(410, "en", "expired");
  }
  // One-time: drop before send so a double-click cannot deliver twice.
  await env.PENDING.delete(token);

  try {
    await env.EMAIL.send(composeInbox(env, msg));
  } catch (err) {
    console.error("contact: inbox mail failed", err instanceof Error ? err.message : err);
    // Put back so the visitor can retry the same link once.
    ctx.waitUntil(env.PENDING.put(token, JSON.stringify(msg), { expirationTtl: PENDING_TTL }));
    return htmlPage(502, msg.lang || "en", "error");
  }
  return htmlPage(200, msg.lang || "en", "ok");
}

/* ---------- Turnstile + rate limit ---------- */
async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  // shortcut: local preview without a secret; set TURNSTILE_SECRET_KEY before production deploy
  if (!secret) return true;
  if (!token || token.length > 2048) {
    console.error("turnstile: missing or oversized token", { len: token.length });
    return false;
  }
  try {
    const body = new FormData();
    body.set("secret", secret);
    body.set("response", token);
    if (ip && ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    if (!res.ok) {
      console.error("turnstile: siteverify HTTP", res.status);
      return false;
    }
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (data.success !== true) {
      console.error("turnstile: siteverify failed", JSON.stringify(data["error-codes"] || data));
      return false;
    }
    return true;
  } catch (err) {
    console.error("turnstile: siteverify threw", err instanceof Error ? err.message : err);
    return false;
  }
}

async function rateOk(ip: string): Promise<boolean> {
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = new Request(`https://ratelimit.sifralabs.internal/${encodeURIComponent(ip)}/${hour}`);
  const hit = await caches.default.match(key);
  const n = hit ? Number(await hit.text()) || 0 : 0;
  if (n >= RATE_PER_HOUR) return false;
  await caches.default.put(key, new Response(String(n + 1), { headers: { "Cache-Control": "max-age=3600" } }));
  return true;
}

/* ---------- mail ---------- */
function composeInbox(env: Env, m: Msg) {
  const product = m.form === "medoc" ? "MeDoc Dentist" : "Sifra Labs";
  const topic = m.form === "medoc" ? "Demo request" : m.topic || "Message";
  const where = [m.org, m.city].filter(Boolean).join(", ");
  const subject = [product, topic, where].filter(Boolean).join(" · ");
  const line = (label: string, v: string) => `${label}: ${v || "–"}`;
  const text = [
    `Message from the ${m.form === "medoc" ? "MeDoc Dentist" : "Sifra Labs"} website.`,
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
  ].join("\n");
  return {
    from: { email: env.CONTACT_FROM, name: "Sifra Labs website" },
    to: env.CONTACT_TO,
    replyTo: { email: m.email, name: m.name },
    subject,
    text,
  };
}

/* ---------- confirm HTML (quiet, matches site tone) — legacy tokens only ---------- */
function htmlPage(status: number, lang: string, kind: "ok" | "expired" | "invalid" | "error"): Response {
  const L = pageCopy(lang, kind);
  const dir = lang === "ar" ? "rtl" : "ltr";
  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${esc(L.title)} · Sifra Labs</title>
  <style>
    :root { color-scheme: light dark; --ink: #1a1a1a; --muted: #5c5c5c; --line: #e5e0d8; --bg: #f7f4ef; --panel: #fff; }
    @media (prefers-color-scheme: dark) {
      :root { --ink: #f2efe8; --muted: #b0aaa0; --line: #3a3630; --bg: #161410; --panel: #1f1c18; }
    }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
      font: 400 17px/1.5 system-ui, sans-serif; color: var(--ink); background: var(--bg); }
    main { max-width: 28rem; padding: 2rem; border: 1px solid var(--line); border-radius: 12px; background: var(--panel); }
    h1 { margin: 0 0 0.75rem; font-size: 1.35rem; font-weight: 600; letter-spacing: -0.02em; }
    p { margin: 0 0 1rem; color: var(--muted); }
    a { color: inherit; }
  </style>
</head>
<body>
  <main>
    <h1>${esc(L.title)}</h1>
    <p>${esc(L.body)}</p>
    <p><a href="https://sifralabs.com/">${esc(L.home)}</a></p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function pageCopy(lang: string, kind: "ok" | "expired" | "invalid" | "error") {
  const packs: Record<string, Record<typeof kind, { title: string; body: string; home: string }>> = {
    en: {
      ok: { title: "Message confirmed", body: "Thank you. Your message is on its way to our team. We reply within 24 hours on working days.", home: "Back to Sifra Labs" },
      expired: { title: "Link expired", body: "This confirmation link is no longer valid. Please send the form again.", home: "Back to Sifra Labs" },
      invalid: { title: "Invalid link", body: "This confirmation link is incomplete. Please use the link from your e-mail.", home: "Back to Sifra Labs" },
      error: { title: "Could not deliver", body: "Something went wrong delivering your message. Open the link again in a moment, or write to contact@sifralabs.com.", home: "Back to Sifra Labs" },
    },
    fr: {
      ok: { title: "Message confirmé", body: "Merci. Votre message est en route vers notre équipe. Nous répondons sous 24 heures, jours ouvrés.", home: "Retour à Sifra Labs" },
      expired: { title: "Lien expiré", body: "Ce lien de confirmation n'est plus valable. Merci d'envoyer le formulaire à nouveau.", home: "Retour à Sifra Labs" },
      invalid: { title: "Lien invalide", body: "Ce lien de confirmation est incomplet. Utilisez le lien reçu par e-mail.", home: "Retour à Sifra Labs" },
      error: { title: "Envoi impossible", body: "Le message n'a pas pu être remis. Rouvrez le lien dans un instant, ou écrivez à contact@sifralabs.com.", home: "Retour à Sifra Labs" },
    },
    ar: {
      ok: { title: "تم تأكيد الرسالة", body: "شكرًا. رسالتكم في طريقها إلى فريقنا. نرد خلال 24 ساعة في أيام العمل.", home: "العودة إلى Sifra Labs" },
      expired: { title: "انتهى الرابط", body: "رابط التأكيد لم يعد صالحًا. أرسلوا النموذج من جديد.", home: "العودة إلى Sifra Labs" },
      invalid: { title: "رابط غير صالح", body: "رابط التأكيد غير مكتمل. استخدموا الرابط من بريدكم.", home: "العودة إلى Sifra Labs" },
      error: { title: "تعذّر التسليم", body: "حدث خطأ أثناء تسليم الرسالة. افتحوا الرابط لاحقًا أو راسلوا contact@sifralabs.com.", home: "العودة إلى Sifra Labs" },
    },
  };
  return (packs[lang] ?? packs.en)[kind];
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function digitCount(s: string) {
  return (s.match(/\d/g) ?? []).length;
}

function urlCount(s: string) {
  return (s.match(/https?:\/\/|www\./gi) ?? []).length;
}
