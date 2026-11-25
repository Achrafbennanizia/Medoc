import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
// @ts-expect-error plain ESM helper without types
import { LANGS, PAGES, decorate, includes, loadDict, localiseLinks, translate } from "./i18n/build.mjs";

const root = import.meta.dirname;

// One-line stubs for the translated pages (fr/, ar/, de/ are generated, not committed).
const stubs: Record<string, string> = {};
for (const lang of (LANGS as string[]).filter((l) => l !== "en")) {
  for (const file of PAGES as string[]) {
    const path = `${lang}/${file}`;
    mkdirSync(dirname(resolve(root, path)), { recursive: true });
    writeFileSync(resolve(root, path), `<!-- @translate ${lang} ${file} -->\n`);
    stubs[`${lang}-${file.replace(/\/?index\.html$/, "").replace(/\//g, "-") || "home"}`] = path;
  }
}

// Every page, by URL. Add an English page here and to PAGES in i18n/build.mjs.
const pages: Record<string, string> = {
  home: "index.html",
  products: "products/index.html",
  security: "security/index.html",
  company: "company/index.html",
  contact: "contact/index.html",
  notice: "legal/notice/index.html",
  privacy: "legal/privacy/index.html",
  notFound: "404.html",
  ...stubs,
};

// Partials, translation and per-language links in one pass, before Vite processes the HTML.
function site(): Plugin {
  return {
    name: "sifra-site",
    transformIndexHtml: {
      order: "pre",
      handler: (html, ctx) => {
        let lang = "en";
        let file = ctx.path.replace(/^\//, "") || "index.html";
        if (file.endsWith("/")) file += "index.html";
        const stub = /<!-- @translate (\w+) (\S+) -->/.exec(html);
        if (stub) {
          lang = stub[1]!;
          file = stub[2]!;
          html = readFileSync(resolve(root, file), "utf8");
        }
        html = includes(html, root);
        if (lang !== "en") {
          const missing = new Set<string>();
          html = translate(html, lang, loadDict(root, lang), missing);
          if (missing.size) console.warn(`[i18n] ${lang}/${file}: ${missing.size} untranslated`, [...missing].slice(0, 5));
          html = localiseLinks(html, lang);
        }
        return (PAGES as string[]).includes(file) ? decorate(html, lang, file) : html.replaceAll("<!-- @langs -->", "");
      },
    },
  };
}

export default defineConfig({
  plugins: [site()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, resolve(root, v)])),
    },
  },
});
