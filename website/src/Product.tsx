import { useState } from "react";
import type { Dict, Lang } from "./i18n";
import { PRODUCT_POINTS } from "./product-points";
import { SITE_COPY } from "./site-copy";

// Screenshots live in public/product; BASE_URL keeps them working under the GitHub Pages sub-path.
const shotUrl = (file: string, w?: number) => `${import.meta.env.BASE_URL}product/${file}${w ? `-${w}` : ""}.webp`;

type Shot = { file: string; alt: string; caption: string };
type Theme = "light" | "dark";

/**
 * Screenshots that have a dark twin (`<file>-dark.webp` in public/product), shown when the site is
 * in dark mode. A file not listed here shows its light capture in both themes, so a missing
 * dark capture never breaks the page.
 */
const DARK_SHOTS = new Set<string>([]);

function themed(file: string, theme: Theme) {
  return theme === "dark" && DARK_SHOTS.has(file) ? `${file}-dark` : file;
}

/** The appearance showcase appears once its captures (look-*.webp) are in public/product. */
const LOOKS_READY = false;

function ShotFigure({ shot, eager, theme }: { shot: Shot; eager?: boolean; theme: Theme }) {
  const file = themed(shot.file, theme);
  return (
    <figure className="shot">
      <img
        src={shotUrl(file)}
        srcSet={`${shotUrl(file, 1000)} 1000w, ${shotUrl(file)} 1800w`}
        sizes="(min-width: 1020px) 640px, 100vw"
        alt={shot.alt}
        width={1800}
        height={1165}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
      />
      <figcaption>{shot.caption}</figcaption>
    </figure>
  );
}

const ACCENTS = ["mint", "ocean", "plum", "rose", "amber"] as const;
type Look = "light" | "dark" | (typeof ACCENTS)[number];
/** Swatch colours (the app's accent presets). */
const SWATCH: Record<(typeof ACCENTS)[number], string> = {
  mint: "#0EA07E",
  ocean: "#0A84FF",
  plum: "#AF52DE",
  rose: "#E11D48",
  amber: "#D97706",
};

/** Appearance showcase: one dashboard in light, dark and each accent colour. */
function Looks({ lang }: { lang: Lang }) {
  const c = SITE_COPY[lang].looks;
  const [look, setLook] = useState<Look>("light");
  const file = look === "light" ? "look-mint" : look === "dark" ? "look-dark" : `look-${look}`;
  const label = look === "light" ? c.light : look === "dark" ? c.dark : c.accents[look];
  return (
    <section className="section" id="looks">
      <div className="wrap">
        <header className="section-head">
          <h2>{c.title}</h2>
          <p className="lead">{c.lead}</p>
        </header>
        <div className="looks-pick" role="group" aria-label={c.title}>
          {(["light", "dark"] as const).map((l) => (
            <button key={l} type="button" className="looks-btn" aria-pressed={look === l} onClick={() => setLook(l)}>
              {l === "light" ? c.light : c.dark}
            </button>
          ))}
          <span className="looks-sep" aria-hidden />
          {ACCENTS.map((a) => (
            <button key={a} type="button" className="looks-btn" aria-pressed={look === a} onClick={() => setLook(a)}>
              <span className="looks-swatch" style={{ background: SWATCH[a] }} aria-hidden />
              {c.accents[a]}
            </button>
          ))}
        </div>
        <figure className="shot looks-shot">
          <img
            src={shotUrl(file)}
            srcSet={`${shotUrl(file, 1000)} 1000w, ${shotUrl(file)} 1800w`}
            sizes="(min-width: 1100px) 1040px, 100vw"
            alt={`${c.caption} ${label}`}
            width={1800}
            height={1165}
            loading="lazy"
            decoding="async"
          />
          <figcaption>
            {label} · {c.caption}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export function Product({ t, lang, theme }: { t: Dict; lang: Lang; theme: Theme }) {
  const p = t.product;
  const points = PRODUCT_POINTS[lang];
  return (
    <>
      <section className="section" id="product">
        <div className="wrap">
          <header className="section-head">
            <h2>{p.title}</h2>
            <p className="lead">{p.lead}</p>
          </header>
          {p.sections.map((s, i) => {
            const more = points[s.id];
            return (
              <article className="feature" id={s.id} key={s.id}>
                <div className="feature-copy">
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  {more?.length ? (
                    <ul className="feature-points">
                      {more.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="shots">
                  <ShotFigure shot={s.shots[0]!} eager={i === 0} theme={theme} />
                  {s.shots.length > 1 ? (
                    <details className="more-shots">
                      <summary>{SITE_COPY[lang].moreShots(s.shots.length - 1)}</summary>
                      {s.shots.slice(1).map((shot) => (
                        <ShotFigure key={shot.file} shot={shot} theme={theme} />
                      ))}
                    </details>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {LOOKS_READY ? <Looks lang={lang} /> : null}
      <section className="section section-tint" id="trust">
        <div className="wrap">
          <header className="section-head">
            <h2>{p.trustTitle}</h2>
            <p className="lead">{p.trustLead}</p>
          </header>
          <ul className="trust-list">
            {[...p.trust, ...points.trust].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
