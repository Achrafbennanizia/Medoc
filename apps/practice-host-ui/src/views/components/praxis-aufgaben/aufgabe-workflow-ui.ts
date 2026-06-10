import type { PraxisAufgabeStatus } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import { PRAXIS_AUFGABE_STATUSES, PRAXIS_AUFGABE_TYPS } from "./constants";

/** Drawer copy fallbacks — used when i18n key is missing (e.g. stale dev bundle). */
export const AUFGABE_DRAWER_FALLBACKS: Record<string, string> = {
    "page.praxis_tickets.drawer_eyebrow": "Aufgabe",
    "page.praxis_tickets.drawer_created": "Erstellt",
    "page.praxis_tickets.drawer_updated": "Aktualisiert",
    "page.praxis_tickets.drawer_assignee": "Zugewiesen",
    "page.praxis_tickets.drawer_workflow": "Workflow",
    "page.praxis_tickets.drawer_patient": "Patient",
    "page.praxis_tickets.drawer_creator": "Erstellt von",
    "page.praxis_tickets.drawer_edit": "Bearbeiten",
    "page.praxis_tickets.kommentare_title": "Kommunikation",
    "page.praxis_tickets.kommentare_loading": "Kommentare werden geladen…",
    "page.praxis_tickets.kommentare_empty": "Noch keine Nachrichten — starten Sie den Austausch.",
    "page.praxis_tickets.kommentar_label": "Nachricht",
    "page.praxis_tickets.kommentar_placeholder": "Rückfrage oder Hinweis für das Team…",
    "page.praxis_tickets.kommentar_send": "Senden",
};

export function aufgabeDrawerText(t: (key: string) => string, key: string): string {
    const v = t(key);
    return v === key ? (AUFGABE_DRAWER_FALLBACKS[key] ?? v) : v;
}

export const AUFGABE_WORKFLOW_STEPS = [
    { label: "Offen", status: "OFFEN" as const },
    { label: "In Bearbeitung", status: "IN_BEARBEITUNG" as const },
    { label: "Erledigt", status: "ERLEDIGT_REZEPTION" as const },
    { label: "Validiert", status: "VALIDIERT" as const },
] as const;

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

export function aufgabeStatusLabel(status: PraxisAufgabeStatus): string {
    return PRAXIS_AUFGABE_STATUSES.find((s) => s.value === status)?.label ?? status;
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

export function aufgabeTypLabel(typ: string): string {
    return PRAXIS_AUFGABE_TYPS.find((t) => t.value === typ)?.label ?? typ;
}
