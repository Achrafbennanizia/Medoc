import { legalRoute } from "./Legal";
import type { LegalDocId } from "./legal/types";

/**
 * Hash routes, one page per goal: "#/features", "#/editions" (and "#/editions/<edition>"),
 * "#/digitalization", "#/pricing", "#/morocco", "#/europe", "#/security", "#/faq", "#/demo",
 * and "#/legal/<doc>". Pages other than editions may add "/<section>".
 * A plain anchor ("#contact", "#prices") opens the page that holds that section, so older links
 * and the ones on sifralabs.com keep working. Any other hash is a home-page section.
 */
export type Page = "home" | "features" | "editions" | "security" | "digitalization" | "pricing" | "morocco" | "europe" | "faq" | "demo";
export type EditionId = "essentiel" | "cabinet" | "cabinet-plus";
export const EDITION_IDS: EditionId[] = ["essentiel", "cabinet", "cabinet-plus"];
export type Route =
  | { page: Exclude<Page, "editions">; anchor?: string }
  | { page: "editions"; edition?: EditionId; anchor?: string }
  | { page: "legal"; doc: LegalDocId; anchor?: undefined };

const PAGES = ["features", "editions", "security", "digitalization", "pricing", "morocco", "europe", "faq", "demo"] as const;

/** Old routes that were renamed. */
const RENAMED: Record<string, Exclude<Page, "home">> = { country: "morocco" };

/** Sections that moved off the home page, and the page that holds each one now. */
const SECTION_PAGE: Record<string, Exclude<Page, "home">> = {
  contact: "demo",
  prices: "pricing",
  setups: "pricing",
  digitalization: "digitalization",
  stories: "digitalization",
  "digital-health": "morocco",
  morocco: "morocco",
  faq: "faq",
  editions: "editions",
};

export function parseRoute(hash: string): Route {
  const doc = legalRoute(hash);
  if (doc) return { page: "legal", doc };
  const r = /^#\/([\w-]+)(?:\/([\w-]+))?/.exec(hash);
  if (r) {
    const name = RENAMED[r[1]!] ?? r[1];
    if ((PAGES as readonly string[]).includes(name!)) {
      if (name === "editions") {
        const ed = EDITION_IDS.find((e) => e === r[2]);
        return ed ? { page: "editions", edition: ed } : { page: "editions", anchor: r[2] };
      }
      return { page: name as Exclude<Page, "home" | "editions">, anchor: r[2] };
    }
  }
  const anchor = hash.length > 1 && !hash.startsWith("#/") ? hash.slice(1) : undefined;
  if (anchor && SECTION_PAGE[anchor]) {
    const page = SECTION_PAGE[anchor]!;
    return page === "editions" ? { page, anchor } : { page, anchor };
  }
  return { page: "home", anchor };
}

export const pageHref = (page: Exclude<Page, "home">, anchor?: string) => `#/${page}${anchor ? `/${anchor}` : ""}`;
export const editionHref = (id: EditionId) => `#/editions/${id}`;

/** A section anchor that lives on the Features page ("#calendar") becomes "#/features/calendar". */
export const featureLink = (href: string) => (href.startsWith("#") && !href.startsWith("#/") ? pageHref("features", href.slice(1)) : href);
