import type { Dict, Lang } from "./i18n";
import { PRODUCT_POINTS } from "./product-points";
import { SITE_COPY } from "./site-copy";

// Screenshots live in public/product; BASE_URL keeps them working under the GitHub Pages sub-path.
const shotUrl = (file: string, w?: number) => `${import.meta.env.BASE_URL}product/${file}${w ? `-${w}` : ""}.webp`;

type Shot = { file: string; alt: string; caption: string };

function ShotFigure({ shot, eager }: { shot: Shot; eager?: boolean }) {
  return (
    <figure className="shot">
      <img
        src={shotUrl(shot.file)}
        srcSet={`${shotUrl(shot.file, 1000)} 1000w, ${shotUrl(shot.file)} 1800w`}
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

export function Product({ t, lang }: { t: Dict; lang: Lang }) {
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
                  <ShotFigure shot={s.shots[0]!} eager={i === 0} />
                  {s.shots.length > 1 ? (
                    <details className="more-shots">
                      <summary>{SITE_COPY[lang].moreShots(s.shots.length - 1)}</summary>
                      {s.shots.slice(1).map((shot) => (
                        <ShotFigure key={shot.file} shot={shot} />
                      ))}
                    </details>
                  ) : null}
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
