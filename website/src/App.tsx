import { useEffect, useState } from "react";
import { Product } from "./Product";
import { COMPANY_URL, CONTACT_EMAIL, PRICES, type PlanId, WHATSAPP_NUMBER, mad } from "./config";
import { DICTS, type Dict, LANGS, LOCALE, type Lang } from "./i18n";
import { LEGAL_DOCS, LegalPage, legalHref } from "./Legal";
import { Odontogram } from "./Odontogram";
import { COOKIES, readCookie, writeCookie } from "./prefs";
import { DocumentsGallery, WhatsNew } from "./Sections";
import { SITE_COPY } from "./site-copy";
import { Advantages, DigitalHealth, DigitalizationPack, Pilot, FeaturesHero, Photo, PrivacyBand, SecurityPage, Ways } from "./Pages";
import { PAGES_COPY } from "./pages-copy";
import { type EditionId, type Route, pageHref, parseRoute } from "./route";
import { Everything, FinalCta, MoroccoStrip, PageHead, SeriesBand } from "./Routes";
import { ROUTES_COPY } from "./routes-copy";
import { Contact } from "./Contact";
import { EditionArticle, EditionsPage, EditionsPreview } from "./Editions";
import { EDITION_NAME } from "./editions-copy";
import { DIGITAL_COPY } from "./digital-copy";
import { I } from "./icons";
import { waLink } from "./whatsapp";

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
function Header({ t, lang, setLang, theme, setTheme }: { t: Dict; lang: Lang; setLang: (l: Lang) => void; theme: Theme; setTheme: (t: Theme) => void }) {
  const [open, setOpen] = useState(false);
  const pc = PAGES_COPY[lang];
  const rc = ROUTES_COPY[lang].nav;
  const links = [
    [pageHref("features"), pc.nav.features],
    [pageHref("editions"), rc.editions],
    [pageHref("digitalization"), rc.digitalization],
    [pageHref("pricing"), rc.pricing],
    [pageHref("security"), pc.nav.security],
  ];
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <div className="brand-group">
          <a className="brand" href="#top" aria-label="MeDoc Dentist">
            {I.logo}
            <span>MeDoc Dentist</span>
          </a>
          <a className="by-line" href={COMPANY_URL}>
            {pc.by}
          </a>
        </div>
        <nav className={`nav${open ? " is-open" : ""}`} aria-label={t.nav.menu}>
          {links.map(([href, label]) => (
            <a key={href} href={href} onClick={() => setOpen(false)} aria-current={location.hash.startsWith(href) && href.startsWith("#/") ? "page" : undefined}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-tools">
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
          <a className="btn btn-primary btn-sm hide-sm" href={pageHref("demo")}>
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
function Hero({ t, lang, locale }: { t: Dict; lang: Lang; locale: string }) {
  return (
    <section className="hero" id="top">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <p className="kicker">{t.hero.kicker}</p>
          <h1>{t.hero.title}</h1>
          <p className="lead">{t.hero.lead}</p>
          <div className="cta-row">
            <a className="btn btn-primary" href={pageHref("demo")}>
              {t.hero.ctaDemo}
            </a>
            <a className="btn btn-ghost" href={pageHref("pricing")}>
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
        <div className="hero-visual hero-stage">
          <Photo name="dentist-patient" alt={PAGES_COPY[lang].photoAlt.hero} className="hero-photo" eager sizes="(min-width: 960px) 600px, 100vw" />
          <div className="hero-chart">
            <Odontogram t={t} locale={locale} />
            <p className="chart-hint">{t.hero.chartHint}</p>
          </div>
        </div>
      </div>
    </section>
  );
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

/* ---------- prices (MAD, excl. VAT) ---------- */
function Prices({ t, locale }: { t: Dict; locale: string }) {
  const p = t.prices;
  return (
    <section className="section" id="prices">
      <div className="wrap">
        <header className="section-head">
          <h2>{p.title}</h2>
          <p className="lead">{p.lead}</p>
        </header>
        <div className="licenses">
          {p.licenses.map((l) => {
            const featured = l.id === "cabinet";
            return (
              <article key={l.id} className={`license${featured ? " is-featured" : ""}`}>
                {featured && <p className="featured-tag">{p.recommended}</p>}
                <h3>{l.name}</h3>
                <p className="license-desc">{l.desc}</p>
                <p className="price">
                  <span className="price-n">{mad(PRICES.licenses[l.id as EditionId], locale)}</span>
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
                <a className={`btn ${featured ? "btn-primary" : "btn-ghost"}`} href={pageHref("demo")}>
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
                  <span className="plan-n">{mad(PRICES.plans[pl.id as PlanId], locale)}</span> {p.perMonth}
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


function Footer({ t, lang, setLang }: { t: Dict; lang: Lang; setLang: (l: Lang) => void }) {
  const legal = SITE_COPY[lang].legal.titles;
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <a className="brand" href="#top" aria-label="MeDoc Dentist">
            {I.logo}
            <span>MeDoc Dentist</span>
          </a>
          <p>{t.footer.tagline}</p>
          <p className="fine">
            <a href={COMPANY_URL}>{t.footer.company}</a>
          </p>
          <p className="fine">
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </div>
        <ul className="footer-links" aria-label="MeDoc Dentist">
          <li>
            <a href={pageHref("features")}>{PAGES_COPY[lang].nav.features}</a>
          </li>
          <li>
            <a href={pageHref("security")}>{PAGES_COPY[lang].nav.security}</a>
          </li>
          {(["editions", "digitalization", "pricing", "morocco", "europe", "faq", "demo"] as const).map((p) => (
            <li key={p}>
              <a href={pageHref(p)}>{ROUTES_COPY[lang].nav[p]}</a>
            </li>
          ))}
        </ul>
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
        <p className="fine">© {new Date().getFullYear()} MeDoc Dentist {PAGES_COPY[lang].by}</p>
      </div>
    </footer>
  );
}

/** Says which cookies exist. They are all strictly necessary, so it informs rather than asks. */
function CookieNotice({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(() => readCookie(COOKIES.notice) !== "1");
  if (!open) return null;
  const c = SITE_COPY[lang].cookie;
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
      <a className="btn btn-primary" href={pageHref("demo")} tabIndex={show ? 0 : -1}>
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

type PageCtx = { t: Dict; lang: Lang; locale: string; theme: Theme };

function renderPage(route: Route, { t, lang, locale, theme }: PageCtx) {
  switch (route.page) {
    case "legal":
      return <LegalPage lang={lang} locale={locale} doc={route.doc} />;
    case "features":
      return (
        <>
          <FeaturesHero t={t} lang={lang} />
          <Product t={t} lang={lang} theme={theme} hideHead />
          <DocumentsGallery lang={lang} />
          <WhatsNew lang={lang} locale={locale} />
          <FinalCta lang={lang} />
        </>
      );
    case "editions":
      return route.edition ? (
        <EditionArticle lang={lang} locale={locale} id={route.edition} />
      ) : (
        <>
          <EditionsPage lang={lang} locale={locale} />
          <FinalCta lang={lang} />
        </>
      );
    case "security":
      return (
        <>
          <SecurityPage lang={lang} />
          <FinalCta lang={lang} />
        </>
      );
    case "digitalization":
      return (
        <>
          <PageHead lang={lang} page="digitalization" />
          <DigitalizationPack lang={lang} />
          <Pilot lang={lang} />
          <FinalCta lang={lang} />
        </>
      );
    case "pricing":
      return (
        <>
          <PageHead lang={lang} page="pricing" />
          <Prices t={t} locale={locale} />
          <Setups t={t} />
          <FinalCta lang={lang} />
        </>
      );
    case "morocco":
      return (
        <>
          <PageHead lang={lang} page="morocco" />
          <DigitalHealth lang={lang} />
          <FinalCta lang={lang} />
        </>
      );
    case "europe": {
      const eu = DIGITAL_COPY[lang].europe;
      const head = ROUTES_COPY[lang].heads.europe;
      return (
        <>
          <section className="page-hero" id="top">
            <div className="wrap">
              <p className="kicker">{head.kicker}</p>
              <h1>{head.title}</h1>
              <p className="lead">{head.lead}</p>
              <p>{eu.text}</p>
              <a className="btn btn-primary" href={`mailto:${CONTACT_EMAIL}`}>
                {eu.cta}
              </a>
            </div>
          </section>
        </>
      );
    }
    case "faq":
      return (
        <>
          <PageHead lang={lang} page="faq" />
          <Faq t={t} />
          <FinalCta lang={lang} />
        </>
      );
    case "demo":
      return (
        <>
          <PageHead lang={lang} page="demo" />
          <Contact t={t} lang={lang} locale={locale} />
        </>
      );
    case "home":
      return (
        <>
          <Hero t={t} lang={lang} locale={locale} />
          <SeriesBand lang={lang} />
          <MoroccoStrip lang={lang} />
          <Ways lang={lang} />
          <Advantages lang={lang} />
          <DigitalizationPack lang={lang} />
          <EditionsPreview lang={lang} locale={locale} />
          <Everything lang={lang} />
          <PrivacyBand lang={lang} />
          <Pilot lang={lang} />
          <FinalCta lang={lang} />
        </>
      );
    default: {
      const never: never = route;
      return never;
    }
  }
}

export function App() {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const t = DICTS[lang];

  // Number and date format: Moroccan for French and Arabic ("24 900 MAD").
  const locale = LOCALE[lang];
  // Cookies are written only when the visitor chooses (never for the browser's own preference).
  const setLang = (l: Lang) => {
    setLangState(l);
    writeCookie(COOKIES.lang, l);
  };
  const setTheme = (th: Theme) => {
    setThemeState(th);
    writeCookie(COOKIES.theme, th);
  };

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.meta.description);
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
  }, [lang, t]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Pages: "#/features", "#/security", "#/legal/<doc>"; any other hash is a section of the home page.
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  useEffect(() => {
    const onHash = () => {
      if (location.hash !== "#main") setRoute(parseRoute(location.hash));
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  // A new page starts at its top, or at its section (#prices, #/features/calendar): the DOM only exists after render.
  const routeKey =
    route.page === "legal" ? `legal/${route.doc}` : route.page === "editions" ? `editions/${route.edition ?? route.anchor ?? ""}` : `${route.page}/${route.anchor ?? ""}`;

  // Tab title per page.
  useEffect(() => {
    if (route.page === "home") document.title = t.meta.title;
    else if (route.page === "features") document.title = `${PAGES_COPY[lang].nav.features} · MeDoc Dentist`;
    else if (route.page === "security") document.title = PAGES_COPY[lang].security.meta;
    else if (route.page === "editions" && route.edition) document.title = `${EDITION_NAME[route.edition]} · MeDoc Dentist`;
    else if (route.page === "europe") document.title = `${ROUTES_COPY[lang].heads.europe.title} · MeDoc Dentist`;
    else if (route.page !== "legal") document.title = `${ROUTES_COPY[lang].nav[route.page]} · MeDoc Dentist`;
  }, [lang, t, route]);
  useEffect(() => {
    // A tick later: on first load the browser's own hash scroll runs after this effect.
    const id = setTimeout(() => {
      const el = route.anchor ? document.getElementById(route.anchor) : null;
      if (el) el.scrollIntoView({ behavior: "instant" });
      else if (route.page !== "home" || !route.anchor) scrollTo({ top: 0, behavior: "instant" });
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  return (
    <>
      <a className="skip" href="#main">
        {t.nav.skip}
      </a>
      <Header t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
      <main id="main">{renderPage(route, { t, lang, locale, theme })}</main>
      <Footer t={t} lang={lang} setLang={setLang} />
      {route.page === "legal" ? null : <MobileCta lang={lang} />}
      <CookieNotice lang={lang} />
    </>
  );
}
