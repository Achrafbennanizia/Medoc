import { PRODUCT_SITE_ORIGIN } from "./config";
import type { Lang } from "./i18n";
import type { Route } from "./route";

const OG_LOCALE: Record<Lang, string> = { fr: "fr_MA", ar: "ar_MA", en: "en_GB" };

function setName(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setProp(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/** Keep title / description / Open Graph in sync for crawlers that run JS and for link previews after navigation. */
export function applyDocumentMeta(opts: { title: string; description: string; lang: Lang; route: Route }) {
  const { title, description, lang, route } = opts;
  document.title = title;
  setName("description", description);
  setProp("og:title", title);
  setProp("og:description", description);
  setProp("og:locale", OG_LOCALE[lang]);
  setName("twitter:title", title);
  setName("twitter:description", description);

  const hash =
    route.page === "home"
      ? ""
      : route.page === "legal"
        ? `#/legal/${route.doc}`
        : route.page === "editions" && route.edition
          ? `#/editions/${route.edition}`
          : `#/${route.page}`;
  const url = `${PRODUCT_SITE_ORIGIN}/${hash}`;
  setProp("og:url", url);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", `${PRODUCT_SITE_ORIGIN}/${hash ? hash : ""}`);
}
