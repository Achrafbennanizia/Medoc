import { COMPANY_URL, SERIES_URL } from "./config";
import { DIGITAL_COPY } from "./digital-copy";
import type { Lang } from "./i18n";
import { Photo } from "./Pages";
import { pageHref } from "./route";
import { ROUTES_COPY, type GoalPage } from "./routes-copy";

const HEAD_PHOTO: Record<GoalPage, { name: string; alt: Record<Lang, string> }> = {
  pricing: {
    name: "dental-scan",
    alt: { en: "A dentist in blue gloves pointing at a dental scan on a tablet.", fr: "Un dentiste en gants bleus montrant une radiographie dentaire sur une tablette.", ar: "طبيب أسنان بقفازات زرقاء يشير إلى صورة مسح للأسنان على جهاز لوحي." },
  },
  morocco: {
    name: "clinic-room",
    alt: { en: "A bright dental treatment room.", fr: "Une salle de soins dentaires lumineuse.", ar: "غرفة علاج أسنان مضيئة." },
  },
  faq: {
    name: "xray-review",
    alt: { en: "A dentist reviewing dental X-rays.", fr: "Un dentiste examine des radios dentaires.", ar: "طبيب أسنان يراجع صورًا شعاعية للأسنان." },
  },
  demo: {
    name: "tablet-consult",
    alt: { en: "A dentist showing a patient her X-ray on a tablet.", fr: "Un dentiste montre sa radio à une patiente sur une tablette.", ar: "طبيب أسنان يُري مريضة صورتها الشعاعية على جهاز لوحي." },
  },
};

/** The top of a goal page: what this page is for, in one line. */
export function PageHead({ lang, page }: { lang: Lang; page: GoalPage }) {
  const h = ROUTES_COPY[lang].heads[page];
  const p = HEAD_PHOTO[page];
  return (
    <section className="page-hero" id="top">
      <div className="wrap page-hero-grid">
        <div>
          <p className="kicker">{h.kicker}</p>
          <h1>{h.title}</h1>
          <p className="lead">{h.lead}</p>
        </div>
        <Photo name={p.name} alt={p.alt[lang]} className="page-photo" eager sizes="(min-width: 960px) 520px, 100vw" />
      </div>
    </section>
  );
}

/** Home: MeDoc series framing merged from sifralabs/medoc. */
export function SeriesBand({ lang }: { lang: Lang }) {
  const s = DIGITAL_COPY[lang].series;
  return (
    <section className="section" id="series" aria-labelledby="series-title">
      <div className="wrap">
        <header className="section-head section-head-row">
          <div>
            <p className="kicker">{s.kicker}</p>
            <h2 id="series-title">{s.title}</h2>
            <p className="lead">{s.lead}</p>
          </div>
          <a className="btn btn-ghost" href={SERIES_URL} rel="noopener">
            {s.more}
          </a>
        </header>
        <ol className="series-principles">
          {s.items.map((it) => (
            <li key={it.t}>
              <b>{it.t}</b>
              <span>{it.d}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Home: Morocco figures strip (detail on #/morocco). */
export function MoroccoStrip({ lang }: { lang: Lang }) {
  const m = DIGITAL_COPY[lang].moroccoStrip;
  const sourceLabel = DIGITAL_COPY[lang].sourceLabel;
  return (
    <section className="section section-tint" id="morocco-strip" aria-labelledby="morocco-strip-title">
      <div className="wrap">
        <header className="section-head section-head-row">
          <div>
            <p className="kicker">{m.kicker}</p>
            <h2 id="morocco-strip-title">{m.title}</h2>
            <p className="lead">{m.lead}</p>
          </div>
          <a className="btn btn-ghost" href={pageHref("morocco")}>
            {m.more}
          </a>
        </header>
        <dl className="industry-strip morocco-strip">
          {m.items.map((it) => (
            <div key={it.fig + it.label}>
              <dd>{it.fig}</dd>
              <dt>
                {it.label}{" "}
                <a className="industry-src" href={it.src.u} rel="noopener" target="_blank">
                  {sourceLabel}
                </a>
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Home: Bill 52-26 / Law 09-08 urgency (honest “not law yet”). */
export function WhyNow({ lang }: { lang: Lang }) {
  const w = DIGITAL_COPY[lang].whyNow;
  return (
    <section className="section section-tint" id="why-now" aria-labelledby="why-now-title">
      <div className="wrap why-now">
        <p className="kicker">{w.kicker}</p>
        <h2 id="why-now-title">{w.title}</h2>
        <p className="lead">{w.lead}</p>
        <a className="btn btn-primary" href={pageHref("morocco")}>
          {w.cta}
        </a>
      </div>
    </section>
  );
}

/** Home: named builder + TEAM (no invented testimonials). */
export function WhoBuilds({ lang }: { lang: Lang }) {
  const w = DIGITAL_COPY[lang].whoBuilds;
  return (
    <section className="section" id="who-builds" aria-labelledby="who-builds-title">
      <div className="wrap who-builds">
        <p className="kicker">{w.kicker}</p>
        <h2 id="who-builds-title">{w.title}</h2>
        <p className="lead">{w.text}</p>
        <a className="btn btn-ghost" href={`${COMPANY_URL}about/`} rel="noopener">
          {w.cta}
        </a>
      </div>
    </section>
  );
}

/** Home: everything the practice writes down today, in one program. */
export function Everything({ lang }: { lang: Lang }) {
  const e = ROUTES_COPY[lang].everything;
  return (
    <section className="section everything" id="everything" aria-labelledby="ev-title">
      <div className="wrap">
        <header className="section-head">
          <p className="kicker">{e.kicker}</p>
          <h2 id="ev-title">{e.title}</h2>
          <p className="lead">{e.lead}</p>
        </header>
        <ol className="ev-grid">
          {e.items.map((it) => (
            <li key={it.t}>
              <b>{it.t}</b>
              <span>{it.d}</span>
            </li>
          ))}
        </ol>
        <div className="cta-row ev-cta">
          <a className="btn btn-primary" href={pageHref("demo")}>
            {e.cta}
          </a>
          <span className="ev-note">{e.note}</span>
        </div>
      </div>
    </section>
  );
}

const EXPLORE: ("features" | GoalPage | "security")[] = ["features", "pricing", "morocco", "security", "faq"];

/** Home: one card per page, so every visitor finds the answer they came for. */
export function Explore({ lang }: { lang: Lang }) {
  const x = ROUTES_COPY[lang].explore;
  return (
    <section className="section" id="explore" aria-labelledby="ex-title">
      <div className="wrap">
        <header className="section-head">
          <h2 id="ex-title">{x.title}</h2>
          <p className="lead">{x.lead}</p>
        </header>
        <ul className="explore">
          {EXPLORE.map((p) => (
            <li key={p}>
              <a href={pageHref(p)}>
                <b>{x.cards[p].t}</b>
                <span>{x.cards[p].d}</span>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Closing call to action on every goal page except the demo page itself. */
export function FinalCta({ lang }: { lang: Lang }) {
  const f = ROUTES_COPY[lang].final;
  return (
    <section className="section final-cta" aria-labelledby="final-title">
      <div className="wrap final-inner">
        <h2 id="final-title">{f.title}</h2>
        <p className="lead">{f.text}</p>
        <div className="cta-row">
          <a className="btn btn-primary" href={pageHref("demo")}>
            {f.cta}
          </a>
          <a className="btn btn-ghost" href={pageHref("pricing")}>
            {f.second}
          </a>
        </div>
      </div>
    </section>
  );
}
