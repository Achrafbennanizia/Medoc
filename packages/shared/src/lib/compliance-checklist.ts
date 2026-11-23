/**
 * The practice's data-protection checklist on the Compliance page.
 *
 * Which list applies follows the practice currency: MAD → Moroccan law 09-08 (CNDP),
 * anything else → GDPR. The state is one JSON object in app_kv `compliance.checklist.v1`
 * (practice-wide, synced), so every physician sees who ticked what and when.
 * Item texts live in the locales: `page.compliance.checklist.<jurisdiction>.<id>.title|detail`.
 */

export type ComplianceJurisdiction = "ma" | "eu";

export const COMPLIANCE_CHECKLIST_KV_KEY = "compliance.checklist.v1" as const;

export const COMPLIANCE_ITEMS: Record<ComplianceJurisdiction, readonly string[]> = {
    ma: [
        "cndp_authorization",
        "patient_information",
        "consent",
        "processor_contract",
        "no_transfer",
        "security_measures",
        "retention",
        "rights_procedure",
        "breach_procedure",
        "staff_confidentiality",
    ],
    eu: [
        "ropa",
        "dpia",
        "patient_information",
        "processor_contract",
        "dpo",
        "security_measures",
        "retention",
        "rights_procedure",
        "breach_procedure",
        "staff_confidentiality",
    ],
};

export type ChecklistMark = { done: boolean; by: string; at: string };

export type ComplianceChecklistState = {
    items: Record<string, ChecklistMark>;
    /** CNDP receipt / authorisation number (Morocco). */
    cndpRef: string;
    /** ISO date of the CNDP receipt. */
    cndpDate: string;
};

export const EMPTY_CHECKLIST: ComplianceChecklistState = { items: {}, cndpRef: "", cndpDate: "" };

export function complianceJurisdiction(currency: string | null | undefined): ComplianceJurisdiction {
    return (currency ?? "").trim().toUpperCase() === "MAD" ? "ma" : "eu";
}

/** Stored JSON → state. Anything unreadable becomes an empty checklist, never an error. */
export function parseComplianceChecklist(raw: string | null | undefined): ComplianceChecklistState {
    if (!raw?.trim()) return EMPTY_CHECKLIST;
    try {
        const v = JSON.parse(raw) as Partial<ComplianceChecklistState>;
        const items: Record<string, ChecklistMark> = {};
        for (const [id, m] of Object.entries(v.items ?? {})) {
            if (m && typeof m === "object" && typeof m.done === "boolean") {
                items[id] = { done: m.done, by: typeof m.by === "string" ? m.by : "", at: typeof m.at === "string" ? m.at : "" };
            }
        }
        return {
            items,
            cndpRef: typeof v.cndpRef === "string" ? v.cndpRef : "",
            cndpDate: typeof v.cndpDate === "string" ? v.cndpDate : "",
        };
    } catch {
        return EMPTY_CHECKLIST;
    }
}

export function toggleChecklistItem(
    state: ComplianceChecklistState,
    id: string,
    by: string,
    now: Date = new Date(),
): ComplianceChecklistState {
    const done = !state.items[id]?.done;
    return { ...state, items: { ...state.items, [id]: { done, by, at: now.toISOString() } } };
}

export function checklistProgress(state: ComplianceChecklistState, jurisdiction: ComplianceJurisdiction): { done: number; total: number } {
    const ids = COMPLIANCE_ITEMS[jurisdiction];
    return { done: ids.filter((id) => state.items[id]?.done).length, total: ids.length };
}
