/** Workflow track derived from practice_task kind (no DB column). */
export type PracticeTaskWorkflowTrack = "simple" | "verify";

export function taskWorkflowTrack(kind: string): PracticeTaskWorkflowTrack {
    const k = String(kind).trim().toUpperCase();
    return k === "TICKET" || k === "APPOINTMENT" ? "simple" : "verify";
}
