/**
 * Group sharing rules (docs/architecture/editions-plan.md §4.5, §6.15). Each dentist decides who
 * sees their data per area and who may change it; the backend enforces it in every list and write.
 */
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";

export type ShareArea =
    | "calendar"
    | "work_hours"
    | "clinical"
    | "documents"
    | "payments"
    | "statistics"
    | "tasks"
    | "orders"
    | "history";

export const SHARE_AREAS: readonly ShareArea[] = [
    "calendar",
    "work_hours",
    "clinical",
    "documents",
    "payments",
    "statistics",
    "tasks",
    "orders",
    "history",
];

export type ViewRule =
    | { kind: "everyone" }
    | { kind: "other_admin" }
    | { kind: "chosen"; staff: string[] }
    | { kind: "nobody" };

export type ChangeRule =
    | { kind: "me" }
    | { kind: "me_and_other_admin" }
    | { kind: "me_admin_and"; staff: string[]; reception: boolean }
    | { kind: "everyone" };

export type OwnerRules = {
    view: Record<ShareArea, ViewRule>;
    change: Record<ShareArea, ChangeRule>;
};

export type OwnerAllowances = {
    staffId: string;
    name: string;
    isMe: boolean;
    rules: OwnerRules;
};

export type RuleChange =
    | { kind: "view"; area: ShareArea; rule: ViewRule }
    | { kind: "change"; area: ShareArea; rule: ChangeRule };

export type RecordRule = { kind: "private" } | { kind: "hidden_from"; staff: string[] };

/** Every dentist's rules, mine first. */
export function listAllowances(): Promise<OwnerAllowances[]> {
    return practiceSystem.invoke<OwnerAllowances[]>("allowances_list");
}

/** Change one of my own rules; returns all my rules. */
export function setAllowance(change: RuleChange): Promise<OwnerRules> {
    return practiceSystem.invoke<OwnerRules>("allowances_set", { change });
}

export function getRecordVisibility(entityTable: string, entityId: string): Promise<RecordRule | null> {
    return practiceSystem.invoke<RecordRule | null>("record_visibility_get", { entityTable, entityId });
}

/** "Make private", "Hide from …", or `null` to share the record again. Owner only. */
export function setRecordVisibility(entityTable: string, entityId: string, rule: RecordRule | null): Promise<void> {
    return practiceSystem.invoke<void>("record_visibility_set", { entityTable, entityId, rule });
}

/** Wire value of a rule for a select (the "chosen staff" variants keep their list elsewhere). */
export function ruleValue(rule: ViewRule | ChangeRule): string {
    if (rule.kind === "me_admin_and") return rule.reception ? "me_admin_reception" : "me_admin_staff";
    return rule.kind;
}

export function viewRuleFrom(value: string): ViewRule {
    switch (value) {
        case "other_admin":
        case "nobody":
            return { kind: value };
        case "chosen":
            return { kind: "chosen", staff: [] };
        default:
            return { kind: "everyone" };
    }
}

export function changeRuleFrom(value: string): ChangeRule {
    switch (value) {
        case "me":
        case "me_and_other_admin":
        case "everyone":
            return { kind: value };
        case "me_admin_reception":
            return { kind: "me_admin_and", staff: [], reception: true };
        case "me_admin_staff":
            return { kind: "me_admin_and", staff: [], reception: false };
        default:
            return { kind: "me_and_other_admin" };
    }
}
