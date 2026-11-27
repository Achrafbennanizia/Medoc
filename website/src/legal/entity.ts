import type { LegalEntityToken } from "./types";

/**
 * Publisher details printed in the legal pages.
 * Trade name Sifra Labs; operator Achraf Bennani Ziatni as auto-entrepreneur (Loi n° 114-13).
 * Tax / ICE numbers are filled only when issued — do not invent them.
 */
export const LEGAL_ENTITY: Record<LegalEntityToken, string> = {
  company: "Sifra Labs",
  legalForm:
    "Auto-entrepreneur under Law No. 114-13 (Loi n° 114-13 relative au statut de l'auto-entrepreneur)",
  address: "Morocco",
  country: "Morocco",
  email: "contact@sifralabs.com",
  phone: "On request by e-mail",
  director: "Achraf Bennani Ziatni",
  registry: "Not applicable (auto-entrepreneur)",
  registryNumber: "—",
  vatId: "—",
  taxId: "—",
  ice: "—",
  capital: "Not applicable",
  // Public fact: the site is served by GitHub Pages (see .github/workflows/website.yml).
  hostingProvider: "GitHub Pages, GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA",
  dpoContact: "contact@sifralabs.com",
  court: "Morocco",
};

/** Replaces `{token}` with the entity value; unknown tokens are left visible. */
export function fillLegal(text: string): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in LEGAL_ENTITY ? LEGAL_ENTITY[key as LegalEntityToken] : m,
  );
}
