// Contact details used by the demo form, the WhatsApp button and the footer.
// TODO(owner): replace before publishing. example.com is a reserved domain, so
// nothing is sent to a stranger while these placeholders are in place.
export const CONTACT_EMAIL = "demo@example.com";

// International format without "+" or spaces, e.g. "212600000000".
// Leave empty to hide every WhatsApp button.
export const WHATSAPP_NUMBER = "";

// Prices excl. VAT (HT). Keep in sync with docs/launch/01-business-plan-morocco-first.md §2.
export const PRICES = {
  licenses: {
    essential: { MAD: 24900, EUR: 2500 },
    practice: { MAD: 29900, EUR: 2900 },
    clinic: { MAD: 34900, EUR: 3500 },
  },
  plans: {
    security: { MAD: 110, EUR: 10 },
    comfort: { MAD: 290, EUR: 25 },
    premium: { MAD: 540, EUR: 50 },
  },
} as const;

export type Currency = "MAD" | "EUR";
