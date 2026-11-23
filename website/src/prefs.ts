/**
 * Visitor preferences, kept in first-party cookies.
 *
 * Only choices the visitor makes are stored (language, theme, country, closing the cookie
 * notice). These are strictly necessary for the service asked for and need no consent
 * (ePrivacy art. 5(3); France: art. 82 loi Informatique et Libertés; Germany: § 25 (2) 2 TDDDG;
 * Morocco: loi 09-08). The automatic country guess is never stored. No analytics, no third party.
 * Keep the list in step with `COOKIES` below and the legal pages (src/legal/*.ts).
 */

export type Country = "MA" | "FR" | "DE" | "EU";
export const COUNTRIES: Country[] = ["MA", "FR", "DE", "EU"];

/** Every cookie this site can set, for the cookie notice and the legal pages. */
export const COOKIES = {
  lang: "medoc_lang",
  theme: "medoc_theme",
  country: "medoc_country",
  notice: "medoc_cookie_notice",
} as const;

const ONE_YEAR = 60 * 60 * 24 * 365;

export function readCookie(name: string): string | null {
  try {
    const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
  } catch {
    return null;
  }
}

export function writeCookie(name: string, value: string): void {
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    // Scoped to the site's own path (e.g. /Medoc/ on GitHub Pages), not the whole host.
    const path = import.meta.env.BASE_URL || "/";
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR}; Path=${path}; SameSite=Lax${secure}`;
  } catch {
    /* cookies blocked: the choice lasts for this visit only */
  }
}

/** Time zones of the countries we sell in; everything else in Europe counts as EU. */
const ZONE_COUNTRY: Record<string, Country> = {
  "Africa/Casablanca": "MA",
  "Africa/El_Aaiun": "MA",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Busingen": "DE",
};

/**
 * Best guess of the visitor's country without asking for location access and without sending
 * anything anywhere: the browser's time zone, then the region in its language list
 * (fr-MA, ar-MA, de-DE…). Morocco is the default market.
 */
export function guessCountry(): Country {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    if (ZONE_COUNTRY[zone]) return ZONE_COUNTRY[zone];
    for (const tag of navigator.languages ?? [navigator.language]) {
      const region = tag.split("-")[1]?.toUpperCase();
      if (region === "MA") return "MA";
      if (region === "FR") return "FR";
      if (region === "DE") return "DE";
    }
    if (zone.startsWith("Europe/")) return "EU";
  } catch {
    /* fall through */
  }
  return "MA";
}

/** URL `?country=` (shareable), then the visitor's saved choice, then the guess. */
export function initialCountry(): Country {
  const q = new URLSearchParams(location.search).get("country")?.toUpperCase();
  const saved = readCookie(COOKIES.country);
  for (const c of [q, saved]) if (c && (COUNTRIES as string[]).includes(c)) return c as Country;
  return guessCountry();
}
