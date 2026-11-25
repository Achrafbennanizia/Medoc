import { type FormEvent, useEffect, useState } from "react";
import { Product } from "./Product";
import { COMPANY_URL, CONTACT_EMAIL, type Currency, PRICES, WHATSAPP_NUMBER } from "./config";
import { DICTS, type Dict, LANGS, LOCALE, type Lang } from "./i18n";
import { LEGAL_DOCS, LegalPage, legalHref, legalRoute } from "./Legal";
import { Odontogram } from "./Odontogram";
import { COUNTRY_COPY } from "./country-copy";
import { COOKIES, COUNTRIES, type Country, initialCountry, readCookie, writeCookie } from "./prefs";
import { DocumentsGallery, WhatsNew } from "./Sections";
import { SITE_COPY } from "./site-copy";

type Theme = "light" | "dark";


function initialLang(): Lang {
  const q = new URLSearchParams(location.search).get("lang");
  const saved = readCookie(COOKIES.lang);
  for (const c of [q, saved]) if (c && c in DICTS) return c as Lang;
  const nav = (navigator.language || "fr").slice(0, 2);
  return (nav in DICTS ? nav : "fr") as Lang;
}

function initialTheme(): Theme {
  const saved = readCookie(COOKIES.theme);
  if (saved === "light" || saved === "dark") return saved;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/* ---------- icons (inline, stroke = currentColor) ---------- */
const I = {
  logo: (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--mint)" />
      <path d="M10.5 9.5c-2.2 0-3.5 1.8-3.5 4.4 0 3.4 1.4 4.6 2.1 7.6.4 1.7.8 3 1.9 3 1.4 0 1.5-2.2 2.2-4.2.4-1 .9-1.6 2.8-1.6s2.4.6 2.8 1.6c.7 2 .8 4.2 2.2 4.2 1.1 0 1.5-1.3 1.9-3 .7-3 2.1-4.2 2.1-7.6 0-2.6-1.3-4.4-3.5-4.4-2 0-3 1.1-5.5 1.1s-3.5-1.1-5.5-1.1z" fill="#fff" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  monitor: (
    <svg viewBox="0 0 48 40" width="48" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="42" height="27" rx="3" />
      <path d="M18 37h12M24 30v7" strokeLinecap="round" />
    </svg>
  ),
  laptop: (
    <svg viewBox="0 0 48 40" width="48" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <rect x="8" y="6" width="32" height="22" rx="2.5" />
      <path d="M3 33h42l-3 3H6z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3z" />
    </svg>
  ),
};

function waLink(text: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/* ---------- header ---------- */
function CountrySelect({ lang, country, setCountry, className }: { lang: Lang; country: Country; setCountry: (c: Country) => void; className?: string }) {
  const c = COUNTRY_COPY[lang];
  return (
    <label className={`country-select${className ? ` ${className}` : ""}`}>
      <span className="visually-hidden">{c.label}</span>
      <select value={country} aria-label={c.label} onChange={(e) => setCountry(e.target.value as Country)}>
        {COUNTRIES.map((code) => (
          <option key={code} value={code}>
            {c.names[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Header({
  t,
  lang,
  setLang,
  theme,
  setTheme,
  country,
  setCountry,
}: {
  t: Dict;
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  country: Country;
  setCountry: (c: Country) => void;
}) {
  const [open, setOpen] = useState(false);
  const links = [
    ["#product", t.nav.product],
    ["#roles", t.nav.privacy],
    ["#prices", t.nav.prices],
    ["#faq", t.nav.faq],
  ];
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <a className="brand" href="#top" aria-label="MeDoc">
          {I.logo}
          <span>MeDoc</span>
        </a>
        <nav className={`nav${open ? " is-open" : ""}`} aria-label={t.nav.menu}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </a>
          ))}
          <CountrySelect lang={lang} country={country} setCountry={setCountry} className="show-sm" />
        </nav>
        <div className="header-tools">
          <CountrySelect lang={lang} country={country} setCountry={setCountry} className="hide-sm" />
          <div className="langs" role="group" aria-label={t.nav.language}>
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                lang={l.id}
                className="lang-btn"
                aria-pressed={lang === l.id}
                title={l.name}
                onClick={() => setLang(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label={theme === "dark" ? t.nav.toLight : t.nav.toDark}
            title={theme === "dark" ? t.nav.toLight : t.nav.toDark}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? I.sun : I.moon}
          </button>
          <a className="btn btn-primary btn-sm hide-sm" href="#contact">
            {t.nav.demo}
          </a>
          <button type="button" className="icon-btn menu-btn" aria-expanded={open} aria-label={t.nav.menu} onClick={() => setOpen(!open)}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---------- hero ---------- */
function Hero({ t, locale }: { t: Dict; locale: string }) {
  return (
    <section className="hero" id="top">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <h1>{t.hero.title}</h1>
          <p className="lead">{t.hero.lead}</p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#contact">
              {t.hero.ctaDemo}
            </a>
            <a className="btn btn-ghost" href="#prices">
              {t.hero.ctaPrices}
            </a>
          </div>
          <dl className="facts">
            {t.hero.facts.map((f) => (
              <div key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="hero-visual">
          <Odontogram t={t} locale={locale} />
          <p className="chart-hint">{t.hero.chartHint}</p>
        </div>
      </div>
    </section>
  );
}

function money(v: number, cur: Currency, locale: string) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(v);
}

/* ---------- set-ups ---------- */
function Setups({ t }: { t: Dict }) {
  const s = t.setups;
  const diagrams = [
    <div className="diag" key="one">
      <figure className="node node-main">
        {I.monitor}
        <figcaption>{s.main}</figcaption>
      </figure>
    </div>,
    <div className="diag" key="lan">
      <figure className="node">
        {I.monitor}
        <figcaption>{s.screen}</figcaption>
      </figure>
      <span className="link" />
      <figure className="node node-main">
        {I.monitor}
        <figcaption>{s.main}</figcaption>
      </figure>
      <span className="link" />
      <figure className="node">
        {I.monitor}
        <figcaption>{s.screen}</figcaption>
      </figure>
    </div>,
    <div className="diag" key="peer">
      <figure className="node node-main">
        {I.monitor}
        <figcaption>{s.main}</figcaption>
      </figure>
      <span className="link link-sync" />
      <figure className="node">
        {I.laptop}
        <figcaption>{s.laptop}</figcaption>
      </figure>
    </div>,
  ];
  return (
    <section className="section" id="setups">
      <div className="wrap">
        <header className="section-head">
          <h2>{s.title}</h2>
          <p className="lead">{s.lead}</p>
        </header>
        <div className="setups">
          {s.items.map((it, i) => (
            <article key={it.title} className="setup">
              {diagrams[i]}
              <h3>{it.title}</h3>
              <p className="setup-who">{it.who}</p>
              <p>{it.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- the selected country ---------- */
function CountryReady({ lang, country }: { lang: Lang; country: Exclude<Country, "MA"> }) {
  const m = COUNTRY_COPY[lang].ready[country];
  return (
    <section className="section section-tint" id="morocco">
      <div className="wrap">
        <header className="section-head">
          <h2>{m.title}</h2>
          <p className="lead">{m.lead}</p>
        </header>
        <div className="ready">
          <div>
            <h3>{m.nowTitle}</h3>
            <ul className="ticks">
              {m.now.map((x) => (
                <li key={x}>
                  {I.check}
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{m.notTitle}</h3>
            <ul className="soon">
              {m.not.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Morocco ---------- */
function Morocco({ t }: { t: Dict }) {
  const m = t.morocco;
  return (
    <section className="section section-tint" id="morocco">
      <div className="wrap">
        <header className="section-head">
          <h2>{m.title}</h2>
          <p className="lead">{m.lead}</p>
        </header>
        <div className="ready">
          <div>
            <h3>{m.nowTitle}</h3>
            <ul className="ticks">
              {m.now.map((x) => (
                <li key={x}>
                  {I.check}
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{m.soonTitle}</h3>
            <ul className="soon">
              {m.soon.map((x) => (
                <li key={x}>
                  <span className="badge">{m.soonBadge}</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- prices ---------- */
function Prices({ t, locale, country }: { t: Dict; locale: string; country: Country }) {
  // Dirhams for Morocco, euros elsewhere; the toggle still switches.
  const [cur, setCur] = useState<Currency>(country === "MA" ? "MAD" : "EUR");
  useEffect(() => setCur(country === "MA" ? "MAD" : "EUR"), [country]);
  const p = t.prices;
  return (
    <section className="section" id="prices">
      <div className="wrap">
        <header className="section-head section-head-row">
          <div>
            <h2>{p.title}</h2>
            <p className="lead">{p.lead}</p>
          </div>
          <div className="toggle toggle-sm" role="group" aria-label={p.currency}>
            {(["MAD", "EUR"] as Currency[]).map((c) => (
              <button key={c} type="button" aria-pressed={cur === c} onClick={() => setCur(c)}>
                {c === "MAD" ? "MAD" : "€"}
              </button>
            ))}
          </div>
        </header>
        <div className="licenses">
          {p.licenses.map((l) => {
            const featured = l.id === "practice";
            return (
              <article key={l.id} className={`license${featured ? " is-featured" : ""}`}>
                {featured && <p className="featured-tag">{p.recommended}</p>}
                <h3>{l.name}</h3>
                <p className="license-desc">{l.desc}</p>
                <p className="price">
                  <span className="price-n">{money(PRICES.licenses[l.id as keyof typeof PRICES.licenses][cur], cur, locale)}</span>
                  <span className="price-u">{p.oneTime}</span>
                </p>
                <ul className="ticks">
                  {l.items.map((x) => (
                    <li key={x}>
                      {I.check}
                      {x}
                    </li>
                  ))}
                </ul>
                <a className={`btn ${featured ? "btn-primary" : "btn-ghost"}`} href="#contact">
                  {p.choose}
                </a>
              </article>
            );
          })}
        </div>
        <h3 className="plans-title">{p.plansTitle}</h3>
        <div className="plans">
          {p.plans.map((pl) => (
            <article key={pl.id} className="plan">
              <p className="plan-head">
                <b>{pl.name}</b>
                <span>
                  <span className="plan-n">{money(PRICES.plans[pl.id as keyof typeof PRICES.plans][cur], cur, locale)}</span> {p.perMonth}
                </span>
              </p>
              <ul>
                {pl.items.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="fine">{p.ht}</p>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function Faq({ t }: { t: Dict }) {
  return (
    <section className="section section-tint" id="faq">
      <div className="wrap faq-grid">
        <h2>{t.faq.title}</h2>
        <div className="faq">
          {t.faq.items.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- contact ---------- */
function Contact({ t }: { t: Dict }) {
  const c = t.contact;
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const line = (k: string, label: string) => `${label}: ${String(d.get(k) ?? "").trim()}`;
    const body = [
      line("name", c.name),
      line("practice", c.practice),
      line("city", c.city),
      line("phone", c.phone),
      line("email", c.email),
      "",
      String(d.get("message") ?? "").trim(),
    ].join("\n");
    location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(c.subject)}&body=${encodeURIComponent(body)}`;
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
            <span>{c.email}</span>
            <input name="email" type="email" autoComplete="email" dir="ltr" />
          </label>
          <label className="span-2">
            <span>{c.message}</span>
            <textarea name="message" rows={4} />
          </label>
          <div className="span-2 form-foot">
            <button className="btn btn-primary" type="submit">
              {c.send}
            </button>
            <p className="fine">{c.note}</p>
          </div>
        </form>
      </div>
    </section>
  );
}

function Footer({ t, lang, setLang }: { t: Dict; lang: Lang; setLang: (l: Lang) => void }) {
  const legal = SITE_COPY[lang].legal.titles;
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <a className="brand" href="#top" aria-label="MeDoc">
            {I.logo}
            <span>MeDoc</span>
          </a>
          <p>{t.footer.tagline}</p>
          <p className="fine">
            <a href={COMPANY_URL}>{t.footer.company}</a>
          </p>
          <p className="fine">
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
        <ul className="footer-links" aria-label={t.footer.legal}>
          {LEGAL_DOCS.map((id) => (
            <li key={id}>
              <a href={legalHref(id)}>{legal[id]}</a>
            </li>
          ))}
        </ul>
        <ul className="footer-links" aria-label={t.nav.language}>
          {LANGS.map((l) => (
            <li key={l.id}>
              <button type="button" className="link-btn" lang={l.id} onClick={() => setLang(l.id)}>
                {l.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="wrap">
        <p className="fine device">{t.footer.device}</p>
        <p className="fine">© {new Date().getFullYear()} MeDoc</p>
      </div>
    </footer>
  );
}

/** Says which cookies exist. They are all strictly necessary, so it informs rather than asks. */
function CookieNotice({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(() => readCookie(COOKIES.notice) !== "1");
  if (!open) return null;
  const c = COUNTRY_COPY[lang].cookie;
  return (
    <aside className="cookie-notice" aria-label="Cookies">
      <p>
        {c.text} <a href={legalHref("privacy-policy")}>{c.more}</a>
      </p>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          writeCookie(COOKIES.notice, "1");
          setOpen(false);
        }}
      >
        {c.ok}
      </button>
    </aside>
  );
}

/** Phone only: the demo button stays reachable once the hero has scrolled away. */
function MobileCta({ lang }: { lang: Lang }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;
    const io = new IntersectionObserver(([e]) => setShow(!e!.isIntersecting));
    io.observe(hero);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`mobile-cta${show ? " is-shown" : ""}`} aria-hidden={!show}>
      <a className="btn btn-primary" href="#contact" tabIndex={show ? 0 : -1}>
        {SITE_COPY[lang].mobileDemo}
      </a>
      {WHATSAPP_NUMBER && (
        <a className="btn btn-wa btn-icon" href={waLink(SITE_COPY[lang].mobileDemo)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" tabIndex={show ? 0 : -1}>
          {I.whatsapp}
        </a>
      )}
    </div>
  );
}

export function App() {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const t = DICTS[lang];

  const [country, setCountryState] = useState<Country>(initialCountry);
  // Number and date format: French outside Morocco is fr-FR ("2 500 €"), Moroccan French is fr-MA.
  const locale = lang === "fr" && country !== "MA" ? "fr-FR" : LOCALE[lang];
  // Cookies are written only when the visitor chooses (never for the automatic guesses).
  const setLang = (l: Lang) => {
    setLangState(l);
    writeCookie(COOKIES.lang, l);
  };
  const setTheme = (th: Theme) => {
    setThemeState(th);
    writeCookie(COOKIES.theme, th);
  };
  const setCountry = (c: Country) => {
    setCountryState(c);
    writeCookie(COOKIES.country, c);
  };

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    // The French title names Morocco; a French-speaking visitor elsewhere gets a neutral one.
    const title = lang === "fr" && country !== "MA" ? "Logiciel de gestion de cabinet dentaire · MeDoc" : t.meta.title;
    if (!legalRoute(location.hash)) document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.meta.description);
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
  }, [lang, t, country]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // "#/legal/<doc>" shows a legal page; any other hash is a section of the home page.
  const [route, setRoute] = useState(() => legalRoute(location.hash));
  useEffect(() => {
    const onHash = () => setRoute(legalRoute(location.hash));
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  // Deep links (#prices, #contact…) land on their section: the DOM only exists after render.
  useEffect(() => {
    if (!route && location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [route]);

  return (
    <>
      <a className="skip" href="#main">
        {t.nav.skip}
      </a>
      <Header t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} country={country} setCountry={setCountry} />
      <main id="main">
        {route ? (
          <LegalPage lang={lang} locale={locale} doc={route} />
        ) : (
          <>
            <Hero t={t} locale={locale} />
            <WhatsNew lang={lang} locale={locale} />
            <Product t={t} lang={lang} theme={theme} />
            <DocumentsGallery lang={lang} country={country} />
            {country === "MA" ? <Morocco t={t} /> : <CountryReady lang={lang} country={country} />}
            <Setups t={t} />
            <Prices t={t} locale={locale} country={country} />
            <Faq t={t} />
            <Contact t={t} />
          </>
        )}
      </main>
      <Footer t={t} lang={lang} setLang={setLang} />
      {route ? null : <MobileCta lang={lang} />}
      <CookieNotice lang={lang} />
    </>
  );
}
