/**
 * G10 — Runtime truth for integrations (no false “live” affordances).
 * Hersteller-Portal may override display via `portalIntegrations`; these are local defaults.
 */

export type IntegrationCapability = {
    id: string;
    label: string;
    /** When false, UI must not imply live connector behaviour. */
    available: boolean;
    reasonDe: string;
};

export const LOCAL_INTEGRATION_CAPABILITIES: IntegrationCapability[] = [
    {
        id: "eprescription",
        label: "E-Rezept (Gematik / TI)",
        available: false,
        reasonDe: "TI-Connector und HBA-Anbindung sind in dieser Version nicht produktiv — nur lokale Validierung.",
    },
    {
        id: "kim",
        label: "KIM / TK-Direktabrechnung",
        available: false,
        reasonDe: "Sichere Nachrichtenübertragung (KIM) ist noch nicht angebunden.",
    },
    {
        id: "card_payment",
        label: "Kartenzahlung (Terminal)",
        available: false,
        reasonDe: "Zahlungs-Terminal-Provider liefert Stub-Referenzen (kein Live-Acquiring).",
    },
    {
        id: "sepa_payment",
        label: "SEPA-Lastschrift",
        available: false,
        reasonDe: "SEPA-Einzug ist als Stub implementiert — Status „ausstehend“ ohne Bank-Rückmeldung.",
    },
    {
        id: "dicom",
        label: "DICOM / PACS",
        available: false,
        reasonDe: "C-STORE und PACS-Weiterleitung sind nur als Migrations-Stub verfügbar.",
    },
    {
        id: "gdt",
        label: "GDT-Geräte",
        available: false,
        reasonDe: "GDT-Import parst Dateien zur Verifikation — kein Live-Gerätebus.",
    },
    {
        id: "scanner",
        label: "TWAIN-Scanner",
        available: false,
        reasonDe: "Scanner-Ordner-Import ohne TWAIN-Treiber-Anbindung in der Produktivversion.",
    },
];

export function localCapability(id: string): IntegrationCapability | undefined {
    return LOCAL_INTEGRATION_CAPABILITIES.find((c) => c.id === id);
}
