import { mad, madMonthlySpread, PRICES } from "./config";
import { EDITION_NAME, EDITION_PHOTO, EDITIONS_COPY } from "./editions-copy";
import { DICTS, type Lang } from "./i18n";
import { Photo } from "./Pages";
import { type EditionId, EDITION_IDS, editionHref, pageHref } from "./route";

function fill(template: string, x: string) {
  return template.replace("{x}", x);
}

/** Three edition cards for the home page. */
export function EditionsPreview({ lang, locale }: { lang: Lang; locale: string }) {
  const c = EDITIONS_COPY[lang];
  return (
    <section className="section" id="editions-preview" aria-labelledby="ed-prev-title">
      <div className="wrap">
        <header className="section-head section-head-row">
          <div>
            <p className="kicker">{c.preview.kicker}</p>
            <h2 id="ed-prev-title">{c.preview.title}</h2>
            <p className="lead">{c.preview.lead}</p>
          </div>
          <a className="btn btn-ghost" href={pageHref("editions")}>
            {c.ui.compare}
          </a>
        </header>
        <ul className="edition-cards">
          {EDITION_IDS.map((id) => {
            const ed = c.editions[id];
            return (
              <li key={id} className="edition-card">
                <Photo name={EDITION_PHOTO[id]} alt={ed.photoAlt} sizes="(min-width: 960px) 320px, 100vw" />
                <div className="edition-card-body">
                  <h3>{EDITION_NAME[id]}</h3>
                  <p className="edition-for">{ed.forLine}</p>
                  <p className="edition-card-meta">{ed.card}</p>
                  <p className="edition-price">
                    {mad(PRICES.licenses[id], locale)} <span>{c.ui.oneTime}</span>
                  </p>
                  <p className="edition-price-month">
                    {DICTS[lang].prices.monthlyApprox.replace("{x}", madMonthlySpread(PRICES.licenses[id], locale))}
                  </p>
                  <a className="btn btn-primary btn-sm" href={editionHref(id)}>
                    {fill(c.ui.see, EDITION_NAME[id])}
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Comparison page: cards + table. */
export function EditionsPage({ lang, locale }: { lang: Lang; locale: string }) {
  const c = EDITIONS_COPY[lang];
  const plansFrom = mad(PRICES.plans.security, locale);
  return (
    <>
      <section className="page-hero" id="top">
        <div className="wrap">
          <p className="kicker">{c.page.kicker}</p>
          <h1>{c.page.title}</h1>
          <p className="lead">{c.page.lead}</p>
          <p className="fine">{c.page.unsure}</p>
          <div className="cta-row">
            <a className="btn btn-primary" href={pageHref("demo")}>
              {c.ui.demo}
            </a>
            <a className="btn btn-ghost" href="#compare">
              {c.ui.compare}
            </a>
          </div>
        </div>
      </section>
      <EditionsPreview lang={lang} locale={locale} />
      <section className="section section-tint" id="compare" aria-labelledby="compare-title">
        <div className="wrap">
          <header className="section-head">
            <h2 id="compare-title">{c.page.compareTitle}</h2>
            <p className="lead">{c.page.compareLead}</p>
            <p className="fine">{fill(c.page.plans, plansFrom)}</p>
            <a className="text-link" href={pageHref("pricing")}>
              {c.page.plansLink}
            </a>
          </header>
          <p className="fine ed-table-hint">{c.table.hint}</p>
          <div className="ed-table-wrap">
            <table className="ed-table">
              <caption className="sr-only">{c.table.caption}</caption>
              <thead>
                <tr>
                  <th scope="col">{c.table.corner}</th>
                  {EDITION_IDS.map((id) => (
                    <th key={id} scope="col">
                      <a href={editionHref(id)}>{EDITION_NAME[id]}</a>
                      <span className="ed-th-price">{mad(PRICES.licenses[id], locale)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <TableBlock title={c.table.size.t} rows={c.table.size.rows.map((r) => ({ t: r.t, cells: r.cells }))} />
                <MarkBlock title={c.table.team.t} rows={c.table.team.rows} yes={c.ui.yes} no={c.ui.no} />
                <MarkBlock title={c.table.doctors.t} rows={c.table.doctors.rows} yes={c.ui.yes} no={c.ui.no} />
                <TableBlock
                  title={c.table.service.t}
                  rows={[
                    {
                      t: c.table.service.price.t,
                      d: c.table.service.price.d,
                      cells: [mad(PRICES.licenses.essentiel, locale), mad(PRICES.licenses.cabinet, locale), mad(PRICES.licenses["cabinet-plus"], locale)],
                    },
                    ...c.table.service.rows,
                  ]}
                />
              </tbody>
            </table>
          </div>
          <div className="ed-common">
            <h3>{c.table.common.t}</h3>
            <ul>
              {c.table.common.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function TableBlock({ title, rows }: { title: string; rows: { t: string; d?: string; cells: [string, string, string] }[] }) {
  return (
    <>
      <tr className="ed-group">
        <th colSpan={4}>{title}</th>
      </tr>
      {rows.map((r) => (
        <tr key={r.t}>
          <th scope="row">
            {r.t}
            {r.d ? <span className="ed-row-d">{r.d}</span> : null}
          </th>
          {r.cells.map((cell, i) => (
            <td key={i}>{cell}</td>
          ))}
        </tr>
      ))}
    </>
  );
}

function MarkBlock({
  title,
  rows,
  yes,
  no,
}: {
  title: string;
  rows: { t: string; d: string; marks: [boolean, boolean, boolean] }[];
  yes: string;
  no: string;
}) {
  return (
    <>
      <tr className="ed-group">
        <th colSpan={4}>{title}</th>
      </tr>
      {rows.map((r) => (
        <tr key={r.t}>
          <th scope="row">
            {r.t}
            <span className="ed-row-d">{r.d}</span>
          </th>
          {r.marks.map((ok, i) => (
            <td key={i} className={ok ? "ed-yes" : "ed-no"}>
              {ok ? yes : no}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** One edition article. */
export function EditionArticle({ lang, locale, id }: { lang: Lang; locale: string; id: EditionId }) {
  const c = EDITIONS_COPY[lang];
  const ed = c.editions[id];
  const name = EDITION_NAME[id];
  const only = (eds: EditionId[]) => {
    if (eds.length === 3) return c.ui.every;
    if (eds.length === 1) return fill(c.ui.only, EDITION_NAME[eds[0]!]);
    return eds.map((e) => EDITION_NAME[e]).join(c.ui.and);
  };
  return (
    <>
      <section className="page-hero" id="top">
        <div className="wrap page-hero-grid">
          <div>
            <p className="kicker">{c.ui.kicker}</p>
            <h1>{name}</h1>
            <p className="lead">{ed.forLine}</p>
            <p className="edition-price hero-price">
              {mad(PRICES.licenses[id], locale)} <span>{c.ui.oneTime}</span>
            </p>
            <div className="cta-row">
              <a className="btn btn-primary" href={pageHref("demo")}>
                {fill(c.table.cta, name)}
              </a>
              <a className="btn btn-ghost" href={pageHref("editions")}>
                {c.ui.compare}
              </a>
            </div>
          </div>
          <Photo name={EDITION_PHOTO[id]} alt={ed.photoAlt} className="page-photo" eager sizes="(min-width: 960px) 520px, 100vw" />
        </div>
      </section>

      <section className="section" aria-labelledby="who-title">
        <div className="wrap split">
          <div>
            <h2 id="who-title">{c.article.whoTitle}</h2>
            <p className="lead">{ed.who}</p>
            <h3>{c.article.fitsTitle}</h3>
            <ul className="band-points">
              {ed.fits.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="section section-tint" aria-labelledby="day-title">
        <div className="wrap">
          <header className="section-head section-head-row">
            <h2 id="day-title">{c.article.dayTitle}</h2>
            <a className="btn btn-ghost" href={pageHref("features")}>
              {c.article.dayMore}
            </a>
          </header>
          <ul className="protect">
            {ed.day.map((d) => (
              <li key={d.t}>
                <p className="feature-ed">{only(d.eds)}</p>
                <h3>{d.t}</h3>
                <p>{d.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="inc-title">
        <div className="wrap">
          <header className="section-head">
            <h2 id="inc-title">{c.article.includedTitle}</h2>
            <p className="lead">{c.article.includedLead}</p>
          </header>
          <ul className="band-points">
            {ed.included.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <a className="text-link" href={pageHref("pricing")}>
            {c.article.plansLink}
          </a>
          <h3>{c.article.limitsTitle}</h3>
          <p className="fine">{c.article.limitsLead}</p>
          <ul className="not-yet">
            {ed.limits.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section" aria-labelledby="ed-faq">
        <div className="wrap">
          <h2 id="ed-faq">{fill(c.article.faqTitle, name)}</h2>
          <div className="faq">
            {ed.faq.map((q) => (
              <details key={q.q}>
                <summary>{q.q}</summary>
                <p>{q.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-tint" aria-labelledby="others-title">
        <div className="wrap">
          <h2 id="others-title">{c.article.othersTitle}</h2>
          <p>
            <a href={editionHref(ed.other.id)}>{ed.other.q}</a>
          </p>
        </div>
      </section>

      <section className="final-cta" aria-labelledby="ed-final">
        <div className="wrap">
          <h2 id="ed-final">{ed.final.title}</h2>
          <p>{ed.final.text}</p>
          <a className="btn btn-primary" href={pageHref("demo")}>
            {c.ui.demo}
          </a>
        </div>
      </section>
    </>
  );
}
