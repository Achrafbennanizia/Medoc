/**
 * Legal pages of the website. One set per language, each written for one jurisdiction:
 *   en → European Union (GDPR)          de → Germany (DSGVO, BGB, DDG)
 *   fr → France (RGPD, Code de commerce) ar → Morocco (loi 09-08, DOC, loi 31-08)
 *
 * Text may contain `{token}` placeholders filled from `LEGAL_ENTITY` (see entity.ts), so the
 * owner fills the company details once. Never invent a company detail in the text itself.
 */

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  /** Two-column facts, e.g. "Controller" → "{company}, {address}". */
  | { kind: "facts"; rows: [label: string, value: string][] };

export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };

export type LegalDocument = {
  title: string;
  /** One sentence under the title: what this document is and who it applies to. */
  summary: string;
  /** ISO date the text was last reviewed. */
  updated: string;
  sections: LegalSection[];
};

export type LegalDocId = "legal-notice" | "privacy-notice" | "privacy-policy" | "terms";

export type LegalSet = {
  /** Shown in the page header, e.g. "Applies under German law". */
  jurisdictionLabel: string;
  /** Short reminder that the texts must be checked by a lawyer before publication. */
  reviewNote: string;
  docs: Record<LegalDocId, LegalDocument>;
};

/** Tokens available in the texts. Values live in entity.ts. */
export type LegalEntityToken =
  | "company"
  | "legalForm"
  | "address"
  | "country"
  | "email"
  | "phone"
  | "director"
  | "registry"
  | "registryNumber"
  | "vatId"
  | "taxId"
  | "ice"
  | "capital"
  | "hostingProvider"
  | "dpoContact"
  | "court";
