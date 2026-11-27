// Build-time translation for the Sifra Labs site.
// English pages are the source. For each other language, vite.config.ts writes a one-line stub
// (fr/products/index.html → "<!-- @translate fr products/index.html -->"); the HTML transform below
// loads the English page, resolves partials, swaps every text segment through i18n/<lang>.json,
// rewrites internal links to /<lang>/…, and sets <html lang dir>.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const LANGS = ["en", "fr", "ar"];
export const LANG_LABEL = { en: "EN", fr: "FR", ar: "ع" };
export const LANG_NAME = { en: "English", fr: "Français", ar: "العربية" };

/** GitHub Pages mounts this site under /Medoc/; Cloudflare (sifralabs.com) uses "". */
export const SITE_BASE = process.env.SITE_BASE || "";
/** Public origin host for canonical / og:url (no path). GH Pages: https://achrafbennanizia.github.io */
export const SITE_ORIGIN = process.env.SITE_ORIGIN || "https://sifralabs.com";
/** MeDoc Dentist, built into dist/products/medoc-dentist/ (scripts/build-product.mjs). Root-relative; applyBase adds SITE_BASE. */
export const PRODUCT_SITE = process.env.PRODUCT_SITE || "/products/medoc-dentist/";
/** Cloudflare Worker contact API (Email Sending). Absolute so GH Pages can reach it. */
export const CONTACT_API = process.env.CONTACT_API || "https://sifralabs.com/api/contact";
/** Cloudflare Turnstile site key (public). Test always-pass key until production keys are set. */
export const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || "0x4AAAAAAGWRuo3Zp4ZVJq6h";

// Every translated page, as its English source file.
export const PAGES = [
  "index.html",
  "digitalization/index.html",
  "services/index.html",
  "work/index.html",
  "work/medoc-dentist/index.html",
  "work/medoc-dentist-website/index.html",
  "work/sifralabs/index.html",
  "process/index.html",
  "medoc/index.html",
  "about/index.html",
  "insights/index.html",
  "insights/paper-patient-cards/index.html",
  "insights/bill-52-26/index.html",
  "insights/offline-first/index.html",
  "news/index.html",
  "security/index.html",
  "faq/index.html",
  "contact/index.html",
  "legal/notice/index.html",
  "legal/privacy/index.html",
];

/** "products/index.html" → "/products/"; "index.html" → "/". */
export const pageUrl = (file) => "/" + file.replace(/index\.html$/, "");
const PAGE_URLS = PAGES.map(pageUrl).sort((a, b) => b.length - a.length);

/** Resolves <!-- @include name --> recursively (partials may include partials). */
export function includes(html, root) {
  const re = /<!-- @include (\w+) -->/g;
  for (let depth = 0; re.test(html) && depth < 5; depth++) {
    html = html.replace(re, (_, name) => readFileSync(resolve(root, "partials", `${name}.html`), "utf8"));
  }
  return html;
}

/** Prefix root-absolute href/src/srcset with SITE_BASE (e.g. /about/ → /Medoc/about/). Skips paths that already include it. */
export function applyBase(html) {
  if (!SITE_BASE) return html;
  const prefix = (path) => {
    if (!path.startsWith("/") || path.startsWith("//")) return path;
    // Leave Vite module entries alone; `base` rewrites their built asset URLs.
    if (path.startsWith("/src/")) return path;
    if (path === SITE_BASE || path.startsWith(`${SITE_BASE}/`)) return path;
    return `${SITE_BASE}${path}`;
  };
  html = html.replace(/(href|src)="([^"]+)"/g, (m, attr, url) => `${attr}="${prefix(url)}"`);
  return html.replace(/srcset="([^"]+)"/g, (_m, value) => {
    const next = value
      .split(",")
      .map((part) => {
        const trimmed = part.trim();
        const sp = trimmed.search(/\s/);
        if (sp < 0) return prefix(trimmed);
        return `${prefix(trimmed.slice(0, sp))}${trimmed.slice(sp)}`;
      })
      .join(", ");
    return `srcset="${next}"`;
  });
}

const collapse = (s) => s.replace(/\s+/g, " ").trim();
// Values that stay as they are in every language: names, addresses, key names, metadata codes.
const KEEP = new Set(["Sifra Labs", "MeDoc Dentist", "Ctrl", "esc", "security.txt", "website", "summary_large_image", "Loi 09-08", "GDPR", "WCAG 2.2", "TelQuel, June 2025", "The HIPAA Journal", "noindex", "index, follow, max-image-preview:large", "MA", "Morocco", "en_GB", "fr_MA", "ar_MA", "صِفر", "cifra", "chiffre", "Ziffer", "cipher", "sifra-mark.svg", "/.well-known/security.txt"]);
const hasWords = (s) => /\p{L}{2,}/u.test(s) && !KEEP.has(s.trim()) && !/^[\w.+-]+@[\w.-]+$/.test(s.trim()) && !/^(IEC|ISO)/.test(s.trim());
const ATTRS = /\b(alt|aria-label|placeholder|content|title)="([^"]*)"/g;
// Text between tags, skipping <script> and <style> blocks.
const TEXT = /(<(script|style)\b[\s\S]*?<\/\2>)|>([^<]+)(?=<)/g;

/** Every translatable segment of a page, in order: for writing and checking the dictionaries. */
export function segments(html) {
  const out = [];
  html.replace(TEXT, (m, block, _t, text) => {
    if (!block && text && hasWords(text)) out.push(collapse(text));
    return m;
  });
  html.replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/g, "").replace(ATTRS, (m, _a, v) => {
    if (hasWords(v) && !/^(https?:|\/|#|width=)/.test(v)) out.push(collapse(v));
    return m;
  });
  return out;
}

export function loadDict(root, lang) {
  const f = resolve(root, "i18n", `${lang}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
}

/** English page HTML (partials resolved) → page in `lang`. Unknown segments stay English and are reported. */
export function translate(html, lang, dict, missing) {
  const tr = (raw) => {
    if (!hasWords(raw)) return raw;
    const key = collapse(raw);
    const val = dict[key];
    if (val === undefined) {
      missing.add(key);
      return raw;
    }
    const lead = raw.match(/^\s*/)[0];
    const trail = raw.match(/\s*$/)[0];
    return lead + val + trail;
  };
  html = html.replace(TEXT, (m, block, _t, text) => (block ? block : `>${tr(text)}`));
  html = html.replace(/(<(?:script|style)\b[\s\S]*?<\/(?:script|style)>)|\b(alt|aria-label|placeholder|content|title)="([^"]*)"/g, (m, block, a, v) => {
    if (block) return block;
    if (!hasWords(v) || /^(https?:|\/|#|width=)/.test(v)) return m;
    return `${a}="${tr(v).replace(/"/g, "&quot;")}"`;
  });
  return html;
}

/** Links to the MeDoc Dentist site open it in the page's language (it reads ?lang=). */
export function localiseProductLinks(html, lang) {
  const esc = PRODUCT_SITE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.replace(new RegExp(`href="(${esc})(\\?[^"#]*)?(#[^"]*)?"`, "g"), (m, base, query = "", hash = "") =>
    `href="${base}${query ? `${query}&` : "?"}lang=${lang}${hash}"`,
  );
}

/** Internal page links → their /<lang>/ version. Assets (/img, /src, /favicon…) are left alone. */
export function localiseLinks(html, lang) {
  if (lang === "en") return html;
  return html.replace(/href="(\/[^"#?]*)([#?][^"]*)?"/g, (m, path, rest = "") => {
    const bare = SITE_BASE && path.startsWith(SITE_BASE) ? path.slice(SITE_BASE.length) || "/" : path;
    if (!PAGE_URLS.includes(bare)) return m;
    return `href="${SITE_BASE}/${lang}${bare}${rest}"`;
  });
}

const OG_LOCALE = { en: "en_GB", fr: "fr_MA", ar: "ar_MA" };

/** <html lang dir>, hreflang alternates, canonical/og:url, and the language switcher for one page. */
export function decorate(html, lang, file) {
  const url = pageUrl(file);
  const href = (l) => (l === "en" ? `${SITE_BASE}${url}` : `${SITE_BASE}/${l}${url}`);
  const abs = `${SITE_ORIGIN}${href(lang)}`;
  html = html.replace(/<html lang="en" dir="ltr">/, `<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">`);
  const alternates = LANGS.map((l) => `    <link rel="alternate" hreflang="${l}" href="${SITE_ORIGIN}${href(l)}" />`).join("\n");
  html = html.replace("</head>", `${alternates}\n    <link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${SITE_BASE}${url}" />\n  </head>`);
  html = html.replace(/<link rel="canonical" href="https:\/\/(?:sifralabs\.com|achrafbennanizia\.github\.io)[^"]*" \/>/, `<link rel="canonical" href="${abs}" />`);
  html = html.replace(/<meta property="og:url" content="https:\/\/(?:sifralabs\.com|achrafbennanizia\.github\.io)[^"]*" \/>/, `<meta property="og:url" content="${abs}" />`);
  html = html.replace(/<meta property="og:locale" content="[^"]*" \/>/, `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`);
  const switcher = LANGS.map(
    (l) => `<a href="${href(l)}" lang="${l}" hreflang="${l}" title="${LANG_NAME[l]}"${l === lang ? ' aria-current="true"' : ""}>${LANG_LABEL[l]}</a>`,
  ).join("");
  return html.replaceAll("<!-- @langs -->", switcher);
}
