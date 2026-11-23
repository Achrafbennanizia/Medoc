import { useState } from "react";
import type { Dict, Lang } from "./i18n";
import { PRODUCT_POINTS } from "./product-points";
import { SITE_COPY } from "./site-copy";

// Screenshots live in public/product; BASE_URL keeps them working under the GitHub Pages sub-path.
const shotUrl = (file: string, w?: number) => `${import.meta.env.BASE_URL}product/${file}${w ? `-${w}` : ""}.webp`;

type Shot = { file: string; alt: string; caption: string };
type Theme = "light" | "dark";

/** Every screenshot exists in the app's light and dark look; the page's theme picks one. */
const themed = (file: string, theme: Theme) => (theme === "dark" ? `${file}-dark` : file);

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

/** Settings section: the same screen in each look of the app (light, dark, five accent colours). */
function Looks({ lang, theme }: { lang: Lang; theme: Theme }) {
  const c = SITE_COPY[lang].looks;
  const [look, setLook] = useState<Look | null>(null);
  const current: Look = look ?? (theme === "dark" ? "dark" : "mint");
  const label = (l: Look) => (l === "light" ? c.light : l === "dark" ? c.dark : c.accents[l]);
  const file = current === "light" ? "looks-mint" : `looks-${current}`;
  return (
    <div className="looks">
      <div className="looks-head">
        <h4>{c.title}</h4>
        <div className="looks-picker" role="radiogroup" aria-label={c.title}>
          {(["light", "dark"] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={current === l} className="looks-mode" onClick={() => setLook(l)}>
              {label(l)}
            </button>
          ))}
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={current === a}
              aria-label={label(a)}
              title={label(a)}
              className={`looks-swatch is-${a}`}
              onClick={() => setLook(a)}
            />
          ))}
        </div>
      </div>
      <figure className="shot">
        <img
          src={shotUrl(file)}
          srcSet={`${shotUrl(file, 1000)} 1000w, ${shotUrl(file)} 1800w`}
          sizes="(min-width: 1020px) 640px, 100vw"
          alt={c.alt(label(current))}
          width={1800}
          height={1165}
          loading="lazy"
          decoding="async"
        />
      </figure>
    </div>
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
                  {s.id === "settings" ? <Looks lang={lang} theme={theme} /> : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
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
