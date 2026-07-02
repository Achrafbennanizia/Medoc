import type { PraxisAufgabeStatus, PraxisAufgabeTyp } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";

export const PRAXIS_AUFGABE_TYPS: readonly { value: PraxisAufgabeTyp; label: string }[] = [
    { value: "ABRECHNUNG", label: "Billing" },
    { value: "TERMIN", label: "Appointment" },
    { value: "DRUCK", label: "Print" },
    { value: "STAMMDATEN", label: "Master data" },
    { value: "SONSTIGES", label: "Other" },
];

export const PRAXIS_AUFGABE_STATUSES: readonly { value: PraxisAufgabeStatus; label: string }[] = [
    { value: "OFFEN", label: "Open" },
    { value: "IN_BEARBEITUNG", label: "In progress" },
    { value: "ERLEDIGT_REZEPTION", label: "Done (reception)" },
    { value: "VALIDIERT", label: "Validated" },
    { value: "ZURUECK", label: "Returned" },
];

/** Status dropdown per RBAC (`aufgabe.status.fulfill` / `aufgabe.status.admin`). */
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
export function aufgabePatientLabel(
    patientId: string | null | undefined,
    patientMap: Map<string, { name: string }>,
    emptyLabel = "—",
): string {
    const id = patientId?.trim();
    if (!id) return emptyLabel;
    return patientMap.get(id)?.name ?? emptyLabel;
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