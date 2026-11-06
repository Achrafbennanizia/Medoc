/**
 * G10 — Runtime truth for integrations (no false “live” affordances).
 * Manufacturer portal may override display via `portalIntegrations`; these are local defaults.
 */

export type IntegrationCapability = {
    id: string;
    available: boolean;
};

export const LOCAL_INTEGRATION_CAPABILITIES: IntegrationCapability[] = [
    { id: "eprescription", available: false },
    { id: "kim", available: false },
    { id: "card_payment", available: false },
    { id: "sepa_payment", available: false },
    { id: "dicom", available: false },
    { id: "gdt", available: false },
    { id: "scanner", available: false },
];

export function integrationCapabilityLabelKey(id: string): string {
    return `settings.integrations.cap.${id}.label`;
}

export function integrationCapabilityReasonKey(id: string): string {
    return `settings.integrations.cap.${id}.reason`;
}

export function localCapability(id: string): IntegrationCapability | undefined {
    return LOCAL_INTEGRATION_CAPABILITIES.find((c) => c.id === id);
}
