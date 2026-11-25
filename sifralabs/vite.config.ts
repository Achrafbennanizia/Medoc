import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const root = import.meta.dirname;

// Every page, by URL. Add a page here and it is built and served.
const pages = {
  home: "index.html",
  products: "products/index.html",
  security: "security/index.html",
  company: "company/index.html",
  contact: "contact/index.html",
  notice: "legal/notice/index.html",
  privacy: "legal/privacy/index.html",
  notFound: "404.html",
};

// `<!-- @include header -->` pulls in partials/header.html, so the nav and footer live in one place.
function includes(): Plugin {
  return {
    name: "sifra-includes",
    // "pre": run before Vite processes the HTML, so the script tag in partials/head.html is bundled.
    transformIndexHtml: {
      order: "pre",
      // Partials may include partials (the header includes the command menu): repeat until none are left.
      handler: (html) => {
        const re = /<!-- @include (\w+) -->/g;
        for (let depth = 0; re.test(html) && depth < 5; depth++) {
          html = html.replace(re, (_, name: string) => readFileSync(resolve(root, "partials", `${name}.html`), "utf8"));
        }
        return html;
      },
    },
  };
}

export default defineConfig({
  plugins: [includes()],
  build: {
    rollupOptions: {
      input: Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, resolve(root, v)])),
    },
  },
});
