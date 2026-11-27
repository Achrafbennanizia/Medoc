import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";

/** One changed field (T5.8): staff ids carry the person's name in `oldLabel` / `newLabel`. */
export type HistoryFieldChange = {
    field: string;
    old: unknown;
    new: unknown;
    oldLabel?: string;
    newLabel?: string;
};

/** One change to a record: who, on which device, when, what. Newest first in lists. */
export type HistoryEntry = {
    id: string;
    table: string;
    entityId: string;
    op: "INSERT" | "UPDATE" | "DELETE";
    actorStaffId?: string | null;
    actorName?: string | null;
    deviceId: string;
    deviceLabel?: string | null;
    at: string;
    changes: HistoryFieldChange[];
};

export type HistoryList = {
    items: HistoryEntry[];
    /** Cabinet+: doctors whose history is not shared with you. */
    hiddenDoctors?: string[];
};

/** Tables with a history (Duo, Cabinet+). */
export type HistoryTable =
    | "patient"
    | "appointment"
    | "payment"
    | "practice_task"
    | "purchase_order"
    | "examination"
    | "treatment"
    | "prescription"
    | "certificate";

export const historyForRecord = (table: HistoryTable, entityId: string) =>
    practiceSystem.invoke<HistoryList>("history_for_record", { table, entityId });

export const historyForPatient = (patientId: string) =>
    practiceSystem.invoke<HistoryList>("history_for_patient", { patientId });
