import type { LegalEntityToken } from "./types";

/**
 * Company details printed in the legal pages.
 * TODO(owner): replace every "[…]" before publishing — a legal page with placeholders is not valid.
 */
export const LEGAL_ENTITY: Record<LegalEntityToken, string> = {
  company: "[Company name]",
  legalForm: "[Legal form, e.g. SARL AU]",
  address: "[Street, postcode, city]",
  country: "[Country]",
  email: "[contact e-mail]",
  phone: "[phone]",
  director: "[Managing director]",
  registry: "[Trade register / Registre du commerce]",
  registryNumber: "[Registration number]",
  vatId: "[VAT ID]",
  taxId: "[Tax ID / IF]",
  ice: "[ICE]",
  capital: "[Share capital]",
  hostingProvider: "[Website host name and address]",
  dpoContact: "[Data-protection contact e-mail]",
  court: "[Competent court / city]",
};

/** Replaces `{token}` with the entity value; unknown tokens are left visible. */
export function fillLegal(text: string): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in LEGAL_ENTITY ? LEGAL_ENTITY[key as LegalEntityToken] : m,
  );
}
