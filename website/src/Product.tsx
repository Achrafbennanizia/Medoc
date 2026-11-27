import { useState } from "react";
import { mad, PRICES } from "./config";
import type { Dict, Lang } from "./i18n";
import { LOCALE } from "./i18n";
import { PRODUCT_POINTS, type Point } from "./product-points";
import { FEATURE_IDS, type FeatureId } from "./product-copy";
import { pageHref } from "./route";
import { SITE_COPY } from "./site-copy";

const shotUrl = (file: string, w?: number) => `${import.meta.env.BASE_URL}product/${file}${w ? `-${w}` : ""}.webp`;

type Shot = { file: string; alt: string; caption: string };
type Theme = "light" | "dark";

const DARK_SHOTS = new Set<string>([]);
const LOOKS_READY = false;

function themed(file: string, theme: Theme) {
  return theme === "dark" && DARK_SHOTS.has(file) ? `${file}-dark` : file;
}

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
const SWATCH: Record<(typeof ACCENTS)[number], string> = {
  mint: "#0EA07E",
  ocean: "#0A84FF",
  plum: "#AF52DE",
  rose: "#E11D48",
  amber: "#D97706",
};

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

function pointText(p: string | Point) {
  return typeof p === "string" ? p : p.t;
}
function pointEd(p: string | Point) {
  return typeof p === "string" ? undefined : p.ed;
}

const AFTER: Partial<Record<FeatureId, "keys" | "keep" | "demo" | "editions" | "security">> = {
  shortcuts: "keys",
  backups: "keep",
  "tooth-chart": "security",
  flags: "demo",
  patients: "editions",
};

export function Product({ t, lang, theme, hideHead }: { t: Dict; lang: Lang; theme: Theme; hideHead?: boolean }) {
  const p = t.product;
  const points = PRODUCT_POINTS[lang];
  const locale = LOCALE[lang];
  const fromPrice = mad(PRICES.licenses.essentiel, locale);

  return (
    <>
      <section className="section" id="product">
        <div className="wrap">
          {hideHead ? null : (
            <header className="section-head">
              <h2>{p.title}</h2>
              <p className="lead">{p.lead}</p>
            </header>
          )}
          <nav className="feature-nav" aria-label={p.nav}>
            {FEATURE_IDS.map((id) => (
              <a key={id} href={pageHref("features", id)}>
                {p.features[id].chip}
              </a>
            ))}
          </nav>
          {FEATURE_IDS.map((id, i) => {
            const f = p.features[id];
            const more = points[id] ?? [];
            const band = AFTER[id];
            return (
              <div key={id}>
                <article className="feature" id={id}>
                  <div className="feature-copy">
                    <p className="feature-chip">
                      <span>{f.chip}</span>
                      <span className="feature-ed">{p.ed[f.ed]}</span>
                    </p>
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                    {more.length ? (
                      <ul className="feature-points">
                        {more.map((line) => {
                          const ed = pointEd(line);
                          return (
                            <li key={pointText(line)}>
                              {pointText(line)}
                              {ed ? <span className="point-ed">{p.ed[ed]}</span> : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                  {id === "shortcuts" ? (
                    <ul className="keys-list">
                      {p.keys.map((k) => (
                        <li key={k.k}>
                          <span className="keycaps">
                            {k.k.split(" ").map((cap, n) => (
                              <kbd key={`${k.k}-${n}`}>{cap}</kbd>
                            ))}
                          </span>
                          <span>{k.d}</span>
                        </li>
                      ))}
                    </ul>
                  ) : id === "backups" ? (
                    <div className="keep-card">
                      <h4>{p.keep.title}</h4>
                      <ul>
                        <li>{p.keep.days}</li>
                        <li>{p.keep.week}</li>
                        <li>{p.keep.half}</li>
                      </ul>
                      <p className="fine">{p.keep.note}</p>
                    </div>
                  ) : f.shots.length ? (
                    <div className="shots">
                      <ShotFigure shot={f.shots[0]!} eager={i === 0} theme={theme} />
                      {f.shots.length > 1 ? (
                        <details className="more-shots">
                          <summary>{SITE_COPY[lang].moreShots(f.shots.length - 1)}</summary>
                          {f.shots.slice(1).map((shot) => (
                            <ShotFigure key={shot.file} shot={shot} theme={theme} />
                          ))}
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                </article>
                {band === "demo" ? (
                  <aside className="feature-band">
                    <div className="feature-band-inner">
                      <div>
                        <h3>{p.demo.title}</h3>
                        <p>{p.demo.text}</p>
                      </div>
                      <a className="btn btn-primary" href={pageHref("demo")}>
                        {p.demo.cta}
                      </a>
                    </div>
                  </aside>
                ) : null}
                {band === "editions" ? (
                  <aside className="feature-band">
                    <div className="feature-band-inner">
                      <div>
                        <h3>{p.editions.title}</h3>
                        <p>{p.editions.text}</p>
                        <p className="fine">{p.editions.price(fromPrice)}</p>
                      </div>
                      <a className="btn btn-ghost" href={pageHref("editions")}>
                        {p.editions.cta}
                      </a>
                    </div>
                  </aside>
                ) : null}
                {band === "security" ? (
                  <aside className="feature-band">
                    <div className="feature-band-inner">
                      <div>
                        <h3>{p.security.title}</h3>
                        <p>{p.security.text}</p>
                      </div>
                      <a className="btn btn-ghost" href={pageHref("security")}>
                        {p.security.cta}
                      </a>
                    </div>
                  </aside>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
      {LOOKS_READY ? <Looks lang={lang} /> : null}
    </>
  );
}
