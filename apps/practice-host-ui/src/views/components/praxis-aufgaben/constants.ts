import type { PraxisAufgabeStatus, PraxisAufgabeTyp } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";

export const PRAXIS_AUFGABE_TYPS: readonly { value: PraxisAufgabeTyp; labelKey: string }[] = [
    { value: "ABRECHNUNG", labelKey: "praxis.aufgaben.typ.abrechnung" },
    { value: "TERMIN", labelKey: "praxis.aufgaben.typ.termin" },
    { value: "DRUCK", labelKey: "praxis.aufgaben.typ.druck" },
    { value: "STAMMDATEN", labelKey: "praxis.aufgaben.typ.stammdaten" },
    { value: "SONSTIGES", labelKey: "praxis.aufgaben.typ.sonstiges" },
];

export const PRAXIS_AUFGABE_STATUSES: readonly { value: PraxisAufgabeStatus; labelKey: string }[] = [
    { value: "OFFEN", labelKey: "praxis.aufgaben.status.offen" },
    { value: "IN_BEARBEITUNG", labelKey: "praxis.aufgaben.status.in_bearbeitung" },
    { value: "ERLEDIGT_REZEPTION", labelKey: "praxis.aufgaben.status.erledigt_rezeption" },
    { value: "VALIDIERT", labelKey: "praxis.aufgaben.status.validiert" },
    { value: "ZURUECK", labelKey: "praxis.aufgaben.status.zurueck" },
];

/** Status dropdown per RBAC (`aufgabe.status.fulfill` / `aufgabe.status.admin`). */
export function selectableAufgabeStatuses(opts: {
    current: PraxisAufgabeStatus;
    canAdminStatus: boolean;
    canFulfillStatus: boolean;
}): readonly { value: PraxisAufgabeStatus; labelKey: string }[] {
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
