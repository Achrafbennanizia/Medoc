import type { PraxisAufgabeStatus } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { PRAXIS_AUFGABE_STATUSES, PRAXIS_AUFGABE_TYPS } from "./constants";

/** Drawer copy fallbacks — used when i18n key is missing (e.g. stale dev bundle). */
export const AUFGABE_DRAWER_FALLBACKS: Record<string, string> = {
    "page.praxis_tickets.drawer_eyebrow": "Task",
    "page.praxis_tickets.drawer_created": "Created",
    "page.praxis_tickets.drawer_updated": "Updated",
    "page.praxis_tickets.drawer_assignee": "Assigned",
    "page.praxis_tickets.drawer_workflow": "Workflow",
    "page.praxis_tickets.drawer_patient": "Patient",
    "page.praxis_tickets.drawer_creator": "Created by",
    "page.praxis_tickets.drawer_edit": "Edit",
    "page.praxis_tickets.kommentare_title": "Communication",
    "page.praxis_tickets.kommentare_loading": "Loading comments…",
    "page.praxis_tickets.kommentare_empty": "No messages yet — start the conversation.",
    "page.praxis_tickets.kommentar_label": "Message",
    "page.praxis_tickets.kommentar_placeholder": "Question or note for the team…",
    "page.praxis_tickets.kommentar_send": "Send",
};

export function aufgabeDrawerText(t: (key: string) => string, key: string): string {
    const v = t(key);
    return v === key ? (AUFGABE_DRAWER_FALLBACKS[key] ?? v) : v;
}

export const AUFGABE_WORKFLOW_STEPS = [
    { labelKey: "praxis.aufgaben.workflow.offen", label: "Open", status: "OFFEN" as const },
    { labelKey: "praxis.aufgaben.workflow.in_bearbeitung", label: "In progress", status: "IN_BEARBEITUNG" as const },
    { labelKey: "praxis.aufgaben.workflow.erledigt", label: "Done", status: "ERLEDIGT_REZEPTION" as const },
    { labelKey: "praxis.aufgaben.workflow.validiert", label: "Validated", status: "VALIDIERT" as const },
] as const;

/** Resolve a workflow-step caption via i18n, with English fallback. */
export function aufgabeWorkflowStepLabel(
    t: (key: string) => string,
    step: { labelKey: string; label: string },
): string {
    const v = t(step.labelKey);
    return v === step.labelKey ? step.label : v;
}

export function aufgabeWorkflowActiveStep(status: PraxisAufgabeStatus): number {
    switch (status) {
        case "OFFEN":
        case "ZURUECK":
            return 0;
        case "IN_BEARBEITUNG":
            return 1;
        case "ERLEDIGT_REZEPTION":
            return 2;
        case "VALIDIERT":
            return 3;
        default:
            return 0;
    }
}

export function aufgabeStatusLabel(t: (key: string) => string, status: PraxisAufgabeStatus): string {
    const key = `praxis.aufgaben.status.${status.toLowerCase()}`;
    const v = t(key);
    if (v !== key) return v;
    const fallbackKey = PRAXIS_AUFGABE_STATUSES.find((s) => s.value === status)?.labelKey;
    return fallbackKey ? t(fallbackKey) : status;
}

export function aufgabeStatusPillClass(status: PraxisAufgabeStatus): string {
    switch (status) {
        case "OFFEN":
        case "ZURUECK":
            return "yellow";
        case "IN_BEARBEITUNG":
            return "blue";
        case "ERLEDIGT_REZEPTION":
            return "grey";
        case "VALIDIERT":
            return "green";
        default:
            return "grey";
    }
}

export function aufgabeTypLabel(t: (key: string) => string, typ: string): string {
    const key = `praxis.aufgaben.typ.${typ.toLowerCase()}`;
    const v = t(key);
    if (v !== key) return v;
    const fallbackKey = PRAXIS_AUFGABE_TYPS.find((row) => row.value === typ)?.labelKey;
    return fallbackKey ? t(fallbackKey) : typ;
}