import type { PraxisAufgabeStatus, PraxisAufgabeTyp } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";

export const PRAXIS_AUFGABE_TYPS: readonly { value: PraxisAufgabeTyp; label: string }[] = [
    { value: "ABRECHNUNG", label: "Abrechnung" },
    { value: "TERMIN", label: "Termin" },
    { value: "DRUCK", label: "Druck" },
    { value: "STAMMDATEN", label: "Stammdaten" },
    { value: "SONSTIGES", label: "Sonstiges" },
];

export const PRAXIS_AUFGABE_STATUSES: readonly { value: PraxisAufgabeStatus; label: string }[] = [
    { value: "OFFEN", label: "Offen" },
    { value: "IN_BEARBEITUNG", label: "In Bearbeitung" },
    { value: "ERLEDIGT_REZEPTION", label: "Erledigt (Rezeption)" },
    { value: "VALIDIERT", label: "Validiert" },
    { value: "ZURUECK", label: "Zurück" },
];

/** Status-Dropdown gemäß RBAC (`aufgabe.status.fulfill` / `aufgabe.status.admin`). */
export function selectableAufgabeStatuses(opts: {
    current: PraxisAufgabeStatus;
    canAdminStatus: boolean;
    canFulfillStatus: boolean;
}): readonly { value: PraxisAufgabeStatus; label: string }[] {
    if (opts.canAdminStatus) return PRAXIS_AUFGABE_STATUSES;
    const allowedValues = new Set<PraxisAufgabeStatus>([opts.current]);
    if (opts.canFulfillStatus) {
        allowedValues.add("IN_BEARBEITUNG");
        allowedValues.add("ERLEDIGT_REZEPTION");
    }
    return PRAXIS_AUFGABE_STATUSES.filter((s) => allowedValues.has(s.value));
}

export const AUFGABE_NO_PATIENT_VALUE = "";
export const AUFGABE_NO_PATIENT_LABEL = "Keiner (ohne Patient)";

export function aufgabePatientLabel(
    patientId: string | null | undefined,
    patientMap: Map<string, { name: string }>,
): string {
    const id = patientId?.trim();
    if (!id) return "—";
    return patientMap.get(id)?.name ?? "—";
}

export type AssigneeMode = "rezeption" | "user";

export type PraxisAufgabeTaskForm = {
    patientId: string;
    typ: PraxisAufgabeTyp;
    titel: string;
    body: string;
    assigneeMode: AssigneeMode;
    assigneeUserId: string;
    status: PraxisAufgabeStatus;
};

export function emptyPraxisAufgabeForm(): PraxisAufgabeTaskForm {
    return {
        patientId: AUFGABE_NO_PATIENT_VALUE,
        typ: "SONSTIGES",
        titel: "",
        body: "",
        assigneeMode: "rezeption",
        assigneeUserId: "",
        status: "OFFEN",
    };
}
