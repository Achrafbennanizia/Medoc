import { useEffect, useState } from "react";
import type { Lang } from "./i18n";
import { LEGAL_AR } from "./legal/ar";
import { LEGAL_EN } from "./legal/en";
import { fillLegal } from "./legal/entity";
import { LEGAL_FR } from "./legal/fr";
import type { LegalBlock, LegalDocId, LegalSet } from "./legal/types";
import { SITE_COPY } from "./site-copy";

/** Every language carries the same Moroccan-law texts (loi 09-08, DOC, loi 31-08), translated. */
const SETS: Record<Lang, LegalSet> = { fr: LEGAL_FR, ar: LEGAL_AR, en: LEGAL_EN };

/** Shown above every legal text, whatever the set says: Morocco is the only jurisdiction. */
const JURISDICTION: Record<Lang, string> = {
  fr: "Rédigé selon le droit marocain",
  ar: "محررة وفق القانون المغربي",
  en: "Written under Moroccan law",
};

export const LEGAL_DOCS: LegalDocId[] = ["legal-notice", "privacy-notice", "privacy-policy", "terms"];

export const legalHref = (id: LegalDocId) => `#/legal/${id}`;

/** "#/legal/terms" → "terms"; anything else → null (the home page). */
export function legalRoute(hash: string): LegalDocId | null {
  const m = /^#\/legal\/([a-z-]+)/.exec(hash);
  return m && (LEGAL_DOCS as string[]).includes(m[1]!) ? (m[1] as LegalDocId) : null;
}

function Block({ b }: { b: LegalBlock }) {
  if (b.kind === "p") return <p>{fillLegal(b.text)}</p>;
  if (b.kind === "list")
    return (
      <ul>
        {b.items.map((x) => (
          <li key={x}>{fillLegal(x)}</li>
        ))}
      </ul>
    );
  return (
    <dl className="legal-facts">
      {b.rows.map(([k, v]) => (
        <div key={k}>
          <dt>{fillLegal(k)}</dt>
          <dd>{fillLegal(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LegalPage({ lang, locale, doc }: { lang: Lang; locale: string; doc: LegalDocId }) {
  const set = SETS[lang];
  const d = set.docs[doc];
  const ui = SITE_COPY[lang].legal;
  const [current, setCurrent] = useState(d.sections[0]?.id ?? "");

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${d.title} · MeDoc Dentist`;
  }, [d]);

  // Scrollspy: the table of contents marks the section being read.
  useEffect(() => {
    const els = d.sections.map((s) => document.getElementById(`s-${s.id}`)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setCurrent(top.target.id.slice(2));
      },
      { rootMargin: "-90px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [d]);

  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(new Date(d.updated));

  return (
    <article className="legal wrap">
      <nav className="legal-docs" aria-label={ui.contents}>
        {LEGAL_DOCS.map((id) => (
          <a key={id} href={legalHref(id)} aria-current={id === doc ? "page" : undefined}>
            {ui.titles[id]}
          </a>
        ))}
      </nav>
      <header className="legal-head">
        <p className="legal-jur">{JURISDICTION[lang]}</p>
        <h1>{d.title}</h1>
        <p className="lead">{fillLegal(d.summary)}</p>
        <p className="fine">
          {ui.updated} <time dateTime={d.updated}>{date}</time>
        </p>
        <p className="legal-review" role="note">
          {set.reviewNote}
        </p>
      </header>
      <div className="legal-grid">
        <details className="legal-toc" open>
          <summary>{ui.contents}</summary>
          <ol>
            {d.sections.map((s) => (
              <li key={s.id}>
                <a href={`#s-${s.id}`} aria-current={current === s.id ? "true" : undefined} onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`s-${s.id}`)?.scrollIntoView();
                }}>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </details>
        <div className="legal-body">
          {d.sections.map((s, i) => (
            <section key={s.id} id={`s-${s.id}`} aria-labelledby={`h-${s.id}`}>
              <h2 id={`h-${s.id}`}>
                {/^\d/.test(s.title) ? null : <span className="legal-n">{i + 1}. </span>}
                {fillLegal(s.title)}
              </h2>
              {s.blocks.map((b, j) => (
                <Block key={j} b={b} />
              ))}
            </section>
          ))}
          <p>
            <a className="btn btn-ghost btn-sm" href="#top">
              {ui.back}
            </a>
          </p>
        </div>
      </div>
    </article>
  );
}
