import { useEffect, useRef, useState } from "react";
import { COUNTRY_COPY } from "./country-copy";
import type { Lang } from "./i18n";
import type { Country } from "./prefs";
import { SITE_COPY } from "./site-copy";

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

/* ---------- What's new ---------- */
export function WhatsNew({ lang, locale }: { lang: Lang; locale: string }) {
  const n = SITE_COPY[lang].news;
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" });
  return (
    <section className="section section-news" id="news" aria-labelledby="news-title">
      <div className="wrap">
        <header className="section-head">
          <h2 id="news-title">{n.title}</h2>
          <p className="lead">{n.lead}</p>
        </header>
        <ol className="news">
          {n.items.map((it) => (
            <li key={it.title} className="news-item">
              <time dateTime={it.date}>{fmt.format(new Date(it.date))}</time>
              <h3>
                <a href={it.href}>{it.title}</a>
              </h3>
              <p>{it.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------- documents gallery ---------- */
export function DocumentsGallery({ lang, country }: { lang: Lang; country: Country }) {
  const docs = SITE_COPY[lang].docs;
  const cc = COUNTRY_COPY[lang];
  // The selected country's documents first; the EU has no national samples, so it sees all.
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setShowAll(false), [country]);
  const filtered = country === "EU" || showAll ? docs.items : docs.items.filter((it) => it.country === country);
  const d = { ...docs, items: filtered.length ? filtered : docs.items };
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [index, setIndex] = useState(0);
  const item = d.items[Math.min(index, d.items.length - 1)]!;
  const rtl = lang === "ar";

  const open = (i: number, btn: HTMLButtonElement) => {
    opener.current = btn;
    setIndex(i);
    dialog.current?.showModal();
  };
  const step = (by: number) => setIndex((i) => (i + by + d.items.length) % d.items.length);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onClose = () => opener.current?.focus();
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, []);

  return (
    <section className="section" id="documents-gallery" aria-labelledby="docs-title">
      <div className="wrap">
        <header className="section-head">
          <h2 id="docs-title">{d.title}</h2>
          <p className="lead">{d.lead}</p>
        </header>
        <ul className="docs">
          {d.items.map((it, i) => (
            <li key={it.file}>
              <button type="button" className="doc-card" aria-haspopup="dialog" onClick={(e) => open(i, e.currentTarget)}>
                <span className="doc-paper">
                  <img src={asset(`documents/${it.file}-thumb.webp`)} alt={`${it.title}, ${d.sample}`} width={600} height={849} loading="lazy" decoding="async" />
                </span>
                <span className="doc-country">{d.countries[it.country]}</span>
                <span className="doc-title">{it.title}</span>
                <span className="doc-caption">{it.caption}</span>
              </button>
            </li>
          ))}
        </ul>
        {country !== "EU" ? (
          <p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? cc.onlyDocs(cc.names[country]) : cc.allDocs}
            </button>
          </p>
        ) : null}
        <p className="fine">{d.sample}</p>
      </div>
      <dialog
        ref={dialog}
        className="lightbox"
        aria-label={item.title}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") step(rtl ? -1 : 1);
          if (e.key === "ArrowLeft") step(rtl ? 1 : -1);
        }}
      >
        <div className="lightbox-bar">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => dialog.current?.close()}>
            {d.close}
          </button>
          <span className="lightbox-count">
            {index + 1} / {d.items.length}
          </span>
          <a className="btn btn-ghost btn-sm" href={asset(`documents/${item.file}.pdf`)} download>
            {d.download}
          </a>
        </div>
        <figure className="lightbox-figure">
          <img src={asset(`documents/${item.file}.webp`)} alt={`${item.title}, ${d.sample}`} width={1131} height={1600} />
          <figcaption>
            <b>{item.title}</b> · {d.countries[item.country]}. {item.caption}
          </figcaption>
        </figure>
        <div className="lightbox-nav">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => step(-1)}>
            {d.prev}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => step(1)}>
            {d.next}
          </button>
        </div>
      </dialog>
    </section>
  );
}
