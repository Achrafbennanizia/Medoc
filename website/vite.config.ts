import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Package: medoc-dentist. It ships inside the company site at /products/medoc-dentist/
// (sifralabs/scripts/build-product.mjs sets PRODUCT_BASE and SITE_ORIGIN). Dev serves it at "/".
const base = process.env.PRODUCT_BASE || "/";
const origin = (process.env.SITE_ORIGIN || "https://sifralabs.com").replace(/\/$/, "");
/** Absolute public URL of this site, e.g. https://sifralabs.com/products/medoc-dentist/ */
const productUrl = `${origin}${base}`;

// index.html and public/sitemap.xml carry absolute URLs (canonical, og:*, JSON-LD).
function productUrlPlaceholder(): Plugin {
  let outDir = "dist";
  return {
    name: "product-url",
    configResolved: (c) => void (outDir = c.build.outDir),
    transformIndexHtml: (html) => html.replaceAll("__PRODUCT_URL__", productUrl),
    // public/ is copied as-is, so fill the sitemap after the build.
    closeBundle() {
      const file = resolve(outDir, "sitemap.xml");
      writeFileSync(file, readFileSync(file, "utf8").replaceAll("__PRODUCT_URL__", productUrl));
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), productUrlPlaceholder()],
  define: { "import.meta.env.VITE_PRODUCT_URL": JSON.stringify(productUrl) },
  server: { host: "127.0.0.1", port: 4173, strictPort: true },
});
