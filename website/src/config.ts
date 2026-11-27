import type { EditionId } from "./route";

// Contact details used by the demo form, the WhatsApp button and the footer.
export const CONTACT_EMAIL = "contact@sifralabs.com";

// Demo form → Cloudflare Worker (Turnstile + confirm link → Email Sending → CONTACT_EMAIL).
// Mailto only if the Worker is unreachable. Override locally with VITE_CONTACT_API.
export const CONTACT_API: string = import.meta.env.VITE_CONTACT_API ?? "https://sifralabs.com/api/contact";

// Cloudflare Turnstile site key (public). Test always-pass key until production keys are set.
export const TURNSTILE_SITE_KEY: string =
  import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA";

// The company site (sifralabs/ in this repo), linked from the footer.
export const COMPANY_URL = "https://sifralabs.com/";

/** MeDoc series page on the company site (level 2). */
export const SERIES_URL = `${COMPANY_URL}medoc/`;

/**
 * Public origin of this product site (level 3).
 * GitHub Pages path stays `/Medoc/` while the repo is named Medoc.
 * Switch to `https://medoc.sifralabs.com` (and vite `base: "/"`) when that domain is live.
 */
export const PRODUCT_SITE_ORIGIN = "https://achrafbennanizia.github.io/Medoc";

// International format without "+" or spaces, e.g. "212600000000".
// Leave empty to hide every WhatsApp button.
export const WHATSAPP_NUMBER = "";

// Prices in dirhams (MAD), excl. VAT (HT), per edition. Morocco is the only market.
// Keep in sync with docs/launch/01-business-plan-morocco-first.md §2.
export const PRICES: { licenses: Record<EditionId, number>; plans: Record<PlanId, number> } = {
  licenses: { essentiel: 24900, cabinet: 29900, "cabinet-plus": 34900 },
  plans: { security: 110, comfort: 290, premium: 540 },
};

export type PlanId = "security" | "comfort" | "premium";

/** "24 900 MAD" in the visitor's language (French and Arabic use the Moroccan format). */
export const mad = (v: number, locale: string) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v);
