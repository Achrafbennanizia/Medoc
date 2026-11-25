import { legalRoute } from "./Legal";
import type { LegalDocId } from "./legal/types";

/** Hash routes: "#/features", "#/features/calendar", "#/security", "#/legal/<doc>"; any other hash is a home-page section. */
export type Page = "home" | "features" | "security";
export type Route = { page: Page; anchor?: string } | { page: "legal"; doc: LegalDocId; anchor?: undefined };

export function parseRoute(hash: string): Route {
  const doc = legalRoute(hash);
  if (doc) return { page: "legal", doc };
  const m = /^#\/(features|security)(?:\/([\w-]+))?/.exec(hash);
  if (m) return { page: m[1] as Page, anchor: m[2] };
  return { page: "home", anchor: hash.length > 1 && !hash.startsWith("#/") ? hash.slice(1) : undefined };
}

export const pageHref = (page: Exclude<Page, "home">, anchor?: string) => `#/${page}${anchor ? `/${anchor}` : ""}`;

/** A section anchor that lives on the Features page ("#calendar") becomes "#/features/calendar". */
export const featureLink = (href: string) => (href.startsWith("#") && !href.startsWith("#/") ? pageHref("features", href.slice(1)) : href);
