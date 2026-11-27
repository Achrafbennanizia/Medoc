import { COMPANY_URL } from "./config";
import type { Dict, Lang } from "./i18n";
import { DIGITAL_COPY } from "./digital-copy";
import { PAGES_COPY } from "./pages-copy";
import { pageHref } from "./route";

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/** A responsive photo from public/photos (900 and 1600 px WebP). */
export function Photo({ name, alt, className, eager, sizes }: { name: string; alt: string; className?: string; eager?: boolean; sizes: string }) {
  return (
    <img
      className={className}
      src={asset(`photos/${name}-900.webp`)}
      srcSet={`${asset(`photos/${name}-900.webp`)} 900w, ${asset(`photos/${name}.webp`)} 1600w`}
      sizes={sizes}
      width={900}
      height={600}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
    />
  );
}

/* ---------- home: feature highlights ---------- */
export function Highlights({ lang }: { lang: Lang }) {
  const h = PAGES_COPY[lang].highlights;
  return (
    <section className="section" id="highlights" aria-labelledby="hl-title">
      <div className="wrap">
        <header className="section-head section-head-row">
          <div>
            <h2 id="hl-title">{h.title}</h2>
            <p className="lead">{h.lead}</p>
          </div>
          <a className="btn btn-ghost" href={pageHref("features")}>
            {h.more}
          </a>
        </header>
        <ul className="highlights">
          {h.cards.map((c) => (
            <li key={c.id}>
              <a href={pageHref("features", c.id)}>
                <img src={asset(c.img)} width={1000} height={648} loading="lazy" decoding="async" alt="" />
                <span className="hl-text">
                  <b>{c.t}</b>
                  <span>{c.d}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------- home: privacy band ---------- */
export function PrivacyBand({ lang }: { lang: Lang }) {
  const pc = PAGES_COPY[lang];
  const b = pc.band;
  return (
    <section className="band" id="roles" aria-labelledby="band-title">
      <div className="wrap band-grid">
        <div className="band-copy">
          <p className="kicker">{b.kicker}</p>
          <h2 id="band-title">{b.title}</h2>
          <p>{b.text}</p>
          <ul className="band-points">
            {b.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <a className="btn btn-light" href={pageHref("security")}>
            {b.more}
          </a>
        </div>
        <Photo name="dental-team" alt={pc.photoAlt.team} className="band-photo" sizes="(min-width: 960px) 520px, 100vw" />
      </div>
    </section>
  );
}

/* ---------- features page hero ---------- */
export function FeaturesHero({ t, lang }: { t: Dict; lang: Lang }) {
  const pc = PAGES_COPY[lang];
  return (
    <section className="page-hero" id="top">
      <div className="wrap page-hero-grid">
        <div>
          <p className="kicker">{pc.features.kicker}</p>
          <h1>{t.product.title}</h1>
          <p className="lead">{t.product.lead}</p>
        </div>
        <Photo name="tablet-consult" alt={pc.photoAlt.tablet} className="page-photo" eager sizes="(min-width: 960px) 520px, 100vw" />
      </div>
    </section>
  );
}

/* ---------- security page ---------- */
export function SecurityPage({ lang }: { lang: Lang }) {
  const pc = PAGES_COPY[lang];
  const s = pc.security;
  return (
    <>
      <section className="page-hero" id="top">
        <div className="wrap page-hero-grid">
          <div>
            <p className="kicker">{s.kicker}</p>
            <h1>{s.title}</h1>
            <p className="lead">{s.lead}</p>
          </div>
          <Photo name="xray-review" alt={pc.photoAlt.xray} className="page-photo" eager sizes="(min-width: 960px) 520px, 100vw" />
        </div>
      </section>

      <section className="section" aria-labelledby="sec-where">
        <div className="wrap split">
          <div>
            <h2 id="sec-where">{s.where.title}</h2>
            <p className="lead">{s.where.text}</p>
          </div>
          <Photo name="clinic-room" alt={pc.photoAlt.clinic} className="side-photo" sizes="(min-width: 960px) 480px, 100vw" />
        </div>
      </section>

      <section className="section section-tint" aria-labelledby="sec-roles">
        <div className="wrap">
          <header className="section-head">
            <h2 id="sec-roles">{s.roles.title}</h2>
            <p className="lead">{s.roles.text}</p>
          </header>
          <div className="roles-pair">
            <figure>
              <img src={asset("product/reception-record-1000.webp")} width={1000} height={625} loading="lazy" decoding="async" alt="" />
              <figcaption>{s.roles.reception}</figcaption>
            </figure>
            <figure>
              <img src={asset("product/patient-record-1000.webp")} width={1000} height={625} loading="lazy" decoding="async" alt="" />
              <figcaption>{s.roles.dentist}</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="sec-protect">
        <div className="wrap">
          <header className="section-head">
            <h2 id="sec-protect">{s.protect.title}</h2>
          </header>
          <ul className="protect">
            {s.protect.items.map((f) => (
              <li key={f.t}>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="sec-notyet">
        <div className="wrap">
          <header className="section-head">
            <h2 id="sec-notyet">{s.notYet.title}</h2>
            <p className="lead">{s.notYet.lead}</p>
          </header>
          <ul className="not-yet">
            {s.notYet.items.map((f) => (
              <li key={f.t}>
                <b>{f.t}</b> {f.d}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="band band-quiet" aria-labelledby="sec-law">
        <div className="wrap law-grid">
          <div>
            <h2 id="sec-law">{s.law.title}</h2>
            <p>{s.law.text}</p>
          </div>
          <div>
            <h2>{s.maker.title}</h2>
            <p>{s.maker.text}</p>
            <a className="btn btn-light" href={`${COMPANY_URL}security/`}>
              {s.maker.link}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

/* ---------- home: Digitalization Pack ---------- */
export function DigitalizationPack({ lang }: { lang: Lang }) {
  const p = DIGITAL_COPY[lang].pack;
  return (
    <section className="section" id="digitalization" aria-labelledby="pack-title">
      <div className="wrap pack-grid">
        <div>
          <p className="kicker">{p.kicker}</p>
          <h2 id="pack-title">{p.title}</h2>
          <p className="lead">{p.lead}</p>
          <ol className="pack-steps">
            {p.steps.map((s) => (
              <li key={s.t}>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </li>
            ))}
          </ol>
          <p className="pack-promise">{p.promise}</p>
          <a className="btn btn-primary" href={pageHref("demo")}>
            {p.cta}
          </a>
        </div>
        <div className="before-after">
          <figure>
            <Photo name="paper-envelopes" alt={p.beforeAlt} sizes="(min-width: 960px) 460px, 100vw" />
            <figcaption>{p.before}</figcaption>
          </figure>
          <figure>
            <Photo name="doctor-desk" alt={p.afterAlt} sizes="(min-width: 960px) 460px, 100vw" />
            <figcaption>{p.after}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ---------- Morocco page: facts + readiness ---------- */
export function DigitalHealth({ lang }: { lang: Lang }) {
  const d = DIGITAL_COPY[lang];
  const { facts, ready } = d.morocco;
  return (
    <>
      <section className="section digital" id="digital-health" aria-labelledby="dh-title">
        <div className="wrap">
          <header className="section-head">
            <p className="kicker">{facts.kicker}</p>
            <h2 id="dh-title">{facts.title}</h2>
            <p className="lead">{facts.lead}</p>
          </header>
          <ul className="ma-facts">
            {facts.items.map((it) => (
              <li key={it.topic}>
                <div className="ma-fact-top">
                  <span className="ma-topic">{it.topic}</span>
                  {it.status ? <span className="ma-status">{it.status}</span> : null}
                </div>
                <p className="ma-fig">{it.fig}</p>
                <p>{it.text}</p>
                <p className="fine">
                  {d.sourceLabel}:{" "}
                  <a href={it.src.u} rel="noopener" target="_blank">
                    {it.src.t}
                  </a>
                </p>
              </li>
            ))}
          </ul>
          <p className="fine">{facts.note}</p>
        </div>
      </section>
      <section className="section" id="morocco-ready" aria-labelledby="ready-title">
        <div className="wrap">
          <header className="section-head">
            <p className="kicker">{ready.kicker}</p>
            <h2 id="ready-title">{ready.title}</h2>
            <p className="lead">{ready.lead}</p>
          </header>
          <ul className="protect">
            {ready.items.map((f) => (
              <li key={f.t}>
                <h3>{f.t}</h3>
                <p>{f.d}</p>
              </li>
            ))}
          </ul>
          <h3 className="not-yet-title">{ready.notYetTitle}</h3>
          <ul className="not-yet">
            {ready.notYet.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="fine">{ready.cndp}</p>
          <a className="btn btn-primary" href={pageHref("demo")}>
            {ready.cta}
          </a>
        </div>
      </section>
    </>
  );
}

/* ---------- home: 10 ways (product benefits, edition-qualified) ---------- */
export function Ways({ lang }: { lang: Lang }) {
  const w = DIGITAL_COPY[lang].ways;
  return (
    <section className="section" id="ways" aria-labelledby="ways-title">
      <div className="wrap">
        <header className="section-head section-head-row">
          <div>
            <p className="kicker">{w.kicker}</p>
            <h2 id="ways-title">{w.title}</h2>
            <p className="lead">{w.lead}</p>
          </div>
          <a className="btn btn-ghost" href={pageHref("features")}>
            {w.more}
          </a>
        </header>
        <ol className="advantages ways-grid">
          {w.items.map((it) => (
            <li key={it.to}>
              <a className="way-link" href={pageHref("features", it.to)}>
                <span className="adv-key" aria-hidden="true">
                  {it.k}
                </span>
                {it.ed ? <p className="way-ed">{it.ed}</p> : null}
                <h3>{it.t}</h3>
                <p>{it.d}</p>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- home: sourced advantages ---------- */
export function Advantages({ lang }: { lang: Lang }) {
  const a = DIGITAL_COPY[lang].advantages;
  const sourceLabel = DIGITAL_COPY[lang].sourceLabel;
  return (
    <section className="section section-tint" id="advantages" aria-labelledby="adv-title">
      <div className="wrap">
        <header className="section-head">
          <p className="kicker">{a.kicker}</p>
          <h2 id="adv-title">{a.title}</h2>
          <p className="lead">{a.lead}</p>
        </header>
        <dl className="industry-strip">
          {a.strip.map((s) => (
            <div key={s.fig + s.claim}>
              <dd>{s.fig}</dd>
              <dt>
                {s.claim}{" "}
                <a className="industry-src" href={s.src.u} rel="noopener" target="_blank">
                  {sourceLabel}
                </a>
              </dt>
            </div>
          ))}
        </dl>
        <p className="industry-note">{a.stripNote}</p>
        <ol className="advantages advantages-sourced">
          {a.items.map((it) => (
            <li key={it.fig + it.market}>
              <span className="adv-key" aria-hidden="true">
                {it.fig}
              </span>
              <p className="adv-market">{it.market}</p>
              <p className="adv-claim">{it.claim}</p>
              <p className="fine">
                {sourceLabel}:{" "}
                <a href={it.src.u} rel="noopener" target="_blank">
                  {it.src.t}
                </a>
              </p>
              <div className="adv-answer">
                <p className="adv-answer-label">{a.answerLabel}</p>
                <h3>{it.answer.t}</h3>
                <p>{it.answer.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- home: pilot practices (real stories go here, with written consent) ---------- */
export function Pilot({ lang }: { lang: Lang }) {
  const p = DIGITAL_COPY[lang].pilot;
  return (
    <section className="section" id="stories" aria-labelledby="pilot-title">
      <div className="wrap pilot">
        <Photo name="tablet-consult" alt={PAGES_COPY[lang].photoAlt.tablet} className="pilot-photo" sizes="(min-width: 960px) 520px, 100vw" />
        <div>
          <p className="kicker">{p.kicker}</p>
          <h2 id="pilot-title">{p.title}</h2>
          <p className="lead">{p.text}</p>
          <ul className="band-points pilot-points">
            {p.points.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <a className="btn btn-primary" href={pageHref("demo")}>
            {p.cta}
          </a>
        </div>
      </div>
    </section>
  );
}
