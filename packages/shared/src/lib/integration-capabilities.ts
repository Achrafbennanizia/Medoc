/**
 * G10 — Runtime truth for integrations (no false “live” affordances).
 * Manufacturer portal may override display via `portalIntegrations`; these are local defaults.
 */

export type IntegrationCapability = {
    id: string;
    label: string;
    /** When false, UI must not imply live connector behaviour. */
    available: boolean;
    /** User-facing reason when unavailable (English source; i18n keys PROPOSED). */
    reasonDe: string;
};

export const LOCAL_INTEGRATION_CAPABILITIES: IntegrationCapability[] = [
    {
        id: "eprescription",
        label: "E-prescription (Gematik / TI)",
        available: false,
        reasonDe: "TI connector and HBA binding are not production-ready in this version — local validation only.",
    },
    {
        id: "kim",
        label: "KIM / TK direct billing",
        available: false,
        reasonDe: "Secure messaging (KIM) is not connected yet.",
    },
    {
        id: "card_payment",
        label: "Card payment (terminal)",
        available: false,
        reasonDe: "Payment terminal provider returns stub references (no live acquiring).",
    },
    {
        id: "sepa_payment",
        label: "SEPA direct debit",
        available: false,
        reasonDe: "SEPA collection is implemented as a stub — status “pending” without bank feedback.",
    },
    {
        id: "dicom",
        label: "DICOM / PACS",
        available: false,
        reasonDe: "C-STORE and PACS forwarding are available only as a migration stub.",
    },
    {
        id: "gdt",
        label: "GDT devices",
        available: false,
        reasonDe: "GDT import parses files for verification — no live device bus.",
    },
    {
        id: "scanner",
        label: "TWAIN scanner",
        available: false,
        reasonDe: "Scanner folder import without TWAIN driver binding in the production build.",
    },
];

export function localCapability(id: string): IntegrationCapability | undefined {
    return LOCAL_INTEGRATION_CAPABILITIES.find((c) => c.id === id);
}
