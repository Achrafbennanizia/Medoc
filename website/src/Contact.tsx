import { type FormEvent, useState } from "react";
import { CONTACT_API, CONTACT_EMAIL, WHATSAPP_NUMBER } from "./config";
import { type Dict, LANGS, type Lang } from "./i18n";
import { I } from "./icons";
import { PAGES_COPY } from "./pages-copy";
import { waLink } from "./whatsapp";

/* Demo request form: sends through CONTACT_API, falls back to the visitor's mail app. */
export function Contact({ t, lang, locale }: { t: Dict; lang: Lang; locale: string }) {
  const c = t.contact;
  const m = PAGES_COPY[lang].mail;
  // After sending: "sent", or "fallback" with the prepared e-mail kept for copying if no mail app opened.
  const [state, setState] = useState<"idle" | "sending" | "sent" | "fallback">("idle");
  const [prepared, setPrepared] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [shownAt] = useState(() => Date.now());
  // One key per request: a double click or a retry is delivered once.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const d = new FormData(form);
    const v = (k: string) => String(d.get(k) ?? "").trim();
    const line = (label: string, value: string) => `${label}: ${value || "–"}`;
    // Default subject, with the practice and city so the inbox shows who is asking.
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
    } else {
      setState("fallback");
      // Opens the visitor's own e-mail app (Mail, Outlook, Gmail…) with everything filled in; they press Send.
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
          {/* Bot trap: people never see or fill this field. */}
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
