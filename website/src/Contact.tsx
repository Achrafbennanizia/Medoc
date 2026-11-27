import { type FormEvent, useEffect, useRef, useState } from "react";
import { CONTACT_API, CONTACT_EMAIL, TURNSTILE_SITE_KEY, WHATSAPP_NUMBER } from "./config";
import { type Dict, LANGS, type Lang } from "./i18n";
import { I } from "./icons";
import { PAGES_COPY } from "./pages-copy";
import { waLink } from "./whatsapp";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      ready: (cb: () => void) => void;
    };
  }
}

/* Demo form: Turnstile → Worker → confirm e-mail; mailto only if the API is down. */
export function Contact({ t, lang, locale }: { t: Dict; lang: Lang; locale: string }) {
  const c = t.contact;
  const m = PAGES_COPY[lang].mail;
  const [state, setState] = useState<"idle" | "sending" | "sent" | "fallback">("idle");
  const [prepared, setPrepared] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shownAt] = useState(() => Date.now());
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [turnstileToken, setTurnstileToken] = useState("");
  const slotRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    const boot = () => {
      const el = slotRef.current;
      if (!el || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(el, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        theme: "auto",
        size: "flexible",
        callback: (token: string) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };
    const existing = document.getElementById("cf-turnstile-api") as HTMLScriptElement | null;
    if (existing) {
      if (window.turnstile) window.turnstile.ready(boot);
      else existing.addEventListener("load", () => window.turnstile?.ready(boot), { once: true });
    } else {
      const s = document.createElement("script");
      s.id = "cf-turnstile-api";
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.addEventListener("load", () => window.turnstile?.ready(boot), { once: true });
      document.head.appendChild(s);
    }
    return () => {
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* widget already gone */
        }
        widgetId.current = null;
      }
    };
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    const line = (label: string, value: string) => `${label}: ${value || "–"}`;
    const subject = [c.subject, [v("practice"), v("city")].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
    const body = [
      m.hello,
      "",
      m.intro,
      "",
      `— ${m.contact} —`,
      line(c.name, v("name")),
      line(c.practice, v("practice")),
      line(c.city, v("city")),
      line(c.phone, v("phone")),
      line(c.email, v("email")),
      "",
      `— ${m.request} —`,
      v("message") || m.noMessage,
      "",
      `— ${m.details} —`,
      line(m.language, LANGS.find((l) => l.id === lang)!.name),
      `${m.sentFrom} ${new Date().toLocaleDateString(locale)}`,
      "",
      m.regards,
      v("name"),
    ].join("\n");
    setPrepared(`${subject}\n\n${body}`);
    setCopied(false);
    setState("sending");
    let ok = false;
    try {
      const res = await fetch(CONTACT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({
          form: "medoc",
          name: v("name"),
          email: v("email"),
          phone: v("phone"),
          org: v("practice"),
          city: v("city"),
          message: v("message"),
          lang,
          website: v("website"),
          elapsed: Date.now() - shownAt,
          turnstile: turnstileToken || v("cf-turnstile-response"),
        }),
      });
      ok = res.ok && ((await res.json()) as { ok?: boolean }).ok === true;
    } catch {
      ok = false;
    }
    if (ok) {
      setState("sent");
      form.reset();
      setKey(crypto.randomUUID());
      setTurnstileToken("");
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    } else {
      setState("fallback");
      location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  };
  const copy = async () => {
    if (!prepared) return;
    try {
      await navigator.clipboard.writeText(`${CONTACT_EMAIL}\n${prepared}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <section className="section" id="contact">
      <div className="wrap contact-grid">
        <div>
          <h2>{c.title}</h2>
          <p className="lead">{c.lead}</p>
          {WHATSAPP_NUMBER && (
            <a className="btn btn-wa" href={waLink(c.subject)} target="_blank" rel="noopener noreferrer">
              {I.whatsapp}
              {c.whatsapp}
            </a>
          )}
          <p className="fine">
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <label className="trap" aria-hidden="true">
            Website <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <label>
            <span>
              {c.name} <abbr title={c.required}>*</abbr>
            </span>
            <input name="name" required autoComplete="name" />
          </label>
          <label>
            <span>
              {c.practice} <abbr title={c.required}>*</abbr>
            </span>
            <input name="practice" required autoComplete="organization" />
          </label>
          <label>
            <span>{c.city}</span>
            <input name="city" autoComplete="address-level2" />
          </label>
          <label>
            <span>
              {c.phone} <abbr title={c.required}>*</abbr>
            </span>
            <input name="phone" type="tel" required autoComplete="tel" dir="ltr" />
          </label>
          <label className="span-2">
            <span>
              {c.email} <abbr title={c.required}>*</abbr>
            </span>
            <input name="email" type="email" required autoComplete="email" dir="ltr" />
          </label>
          <label className="span-2">
            <span>{c.message}</span>
            <textarea name="message" rows={4} />
          </label>
          <div className="span-2 turnstile-slot">
            <div ref={slotRef} />
          </div>
          <div className="span-2 form-foot">
            <button className="btn btn-primary" type="submit" disabled={state === "sending"}>
              {state === "sending" ? m.sending : c.send}
            </button>
            <p className="fine">{c.note}</p>
          </div>
          {state === "sent" ? (
            <div className="span-2 mail-sent" role="status">
              <p>{m.sent}</p>
            </div>
          ) : state === "fallback" && prepared ? (
            <div className="span-2 mail-sent" role="status">
              <p>
                {m.fallback} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
              </p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={copy}>
                {copied ? m.copied : m.copy}
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}
