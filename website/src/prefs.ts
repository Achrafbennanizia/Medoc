/**
 * Visitor preferences, kept in first-party cookies.
 *
 * Only choices the visitor makes are stored (language, theme, closing the cookie notice). They are
 * strictly necessary for the service asked for, and no personal data is collected through them
 * (Morocco: loi 09-08). No analytics, no third party.
 * Keep the list in step with `COOKIES` below and the legal pages (src/legal/*.ts).
 */

/** Every cookie this site can set, for the cookie notice and the legal pages. */
export const COOKIES = {
  lang: "medoc_lang",
  theme: "medoc_theme",
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
