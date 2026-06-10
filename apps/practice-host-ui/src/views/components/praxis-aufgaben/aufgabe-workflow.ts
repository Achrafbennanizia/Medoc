import type { PraxisAufgabe, PraxisAufgabeStatus } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import type { Personal } from "@/models/types";
import { allowed, type PermissionOverride, type Role } from "@/lib/rbac";

export function aufgabeStatusVariant(status: PraxisAufgabeStatus): "default" | "primary" | "warning" | "success" {
    switch (status) {
        case "OFFEN":
        case "ZURUECK":
            return "warning";
        case "IN_BEARBEITUNG":
            return "primary";
        case "ERLEDIGT_REZEPTION":
            return "default";
        case "VALIDIERT":
            return "success";
        default:
            return "default";
    }
}

export function assigneeLabel(row: PraxisAufgabe, personal: Personal[]): string {
    if (row.assignee_role === "REZEPTION") return "Rezeption (Pool)";
    if (row.assignee_user_id) {
        const p = personal.find((x) => x.id === row.assignee_user_id);
        return p ? `${p.name} (${p.rolle})` : row.assignee_user_id;
    }
    return "—";
}

function isPoolTask(a: PraxisAufgabe): boolean {
    return (
        a.assignee_role === "REZEPTION" &&
        (!a.assignee_user_id || a.assignee_user_id.trim() === "")
    );
}

export function canFulfillAsRezeption(a: PraxisAufgabe, userId: string): boolean {
    if (!["OFFEN", "IN_BEARBEITUNG", "ZURUECK"].includes(a.status)) return false;
    if (a.assignee_user_id && a.assignee_user_id.trim() !== "") {
        return a.assignee_user_id === userId;
    }
    return isPoolTask(a);
}

export function canFulfillAsArzt(a: PraxisAufgabe, userId: string): boolean {
    return a.assignee_user_id === userId && ["OFFEN", "IN_BEARBEITUNG", "ZURUECK"].includes(a.status);
}

export function canValidateAsArzt(a: PraxisAufgabe, userId: string): boolean {
    return a.created_by === userId && a.status === "ERLEDIGT_REZEPTION";
}

export function canValidateAsRezeption(a: PraxisAufgabe, userId: string): boolean {
    return a.created_by === userId && a.status === "ERLEDIGT_REZEPTION";
}

/** Mirrors `aufgabe_visibility::user_can_view_aufgabe` (+ admin override). */
export function userCanViewAufgabe(
    a: PraxisAufgabe,
    userId: string,
    opts: { isRezeption: boolean; canAdmin?: boolean },
): boolean {
    if (opts.canAdmin) return true;
    const uid = userId.trim();
    if (a.created_by.trim() === uid && a.status !== "VALIDIERT") return true;
    const assignee = a.assignee_user_id?.trim();
    if (assignee && assignee === uid) return true;
    return opts.isRezeption && isPoolTask(a);
}

export function dispatchNavBadgeRefresh(openAufgaben: number) {
    window.dispatchEvent(
        new CustomEvent("medoc-nav-badges-refresh", { detail: { openAufgaben } }),
    );
}

/** RBAC: `aufgabe.status.fulfill` — In Bearbeitung / Erledigt setzen. */
export function canFulfillAufgabeStatus(
    role: Role | null,
    overrides?: readonly PermissionOverride[],
): boolean {
    return role != null && allowed("aufgabe.status.fulfill", role, overrides);
}

/** RBAC: `aufgabe.status.admin` — beliebiger Statuswechsel. */
export function canAdminAufgabeStatus(
    role: Role | null,
    overrides?: readonly PermissionOverride[],
): boolean {
    return role != null && allowed("aufgabe.status.admin", role, overrides);
}
