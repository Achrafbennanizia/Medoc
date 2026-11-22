/**
 * Roles, privileges and device placement (commands/admin/access.rs). Changing access runs on the
 * main device; on a replica the backend forwards it for the signed-in person.
 */
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { MainOnlyOperation, Placement } from "@/lib/device-flavor";

export type AccessLevel = "none" | "view" | "edit" | "create" | "full";

export type AccessAreaId =
    | "patients"
    | "medical_record"
    | "patient_documents"
    | "calendar"
    | "cash_desk"
    | "billing"
    | "finance_reports"
    | "inventory"
    | "tasks"
    | "staff"
    | "settings"
    | "audit";

export type AccessRole = {
    id: string;
    label: string;
    description: string;
    baseRole: "PHYSICIAN" | "RECEPTION";
    levels: Record<AccessAreaId, AccessLevel>;
};

export type AccessCatalog = {
    levels: AccessLevel[];
    areas: { area: AccessAreaId; scopable: boolean; levels: { level: AccessLevel; actions: string[] }[] }[];
    roles: AccessRole[];
    ceilings: Record<string, Record<AccessAreaId, AccessLevel>>;
    defaultRoles: Record<string, string>;
};

export type StaffAreaAccess = {
    area: AccessAreaId;
    label: string;
    level: AccessLevel;
    templateLevel: AccessLevel;
    ceiling: AccessLevel;
    customised: boolean;
};

export type StaffAccess = {
    staffId: string;
    name: string;
    role: string;
    template: string | null;
    usesRoleDefault: boolean;
    areas: StaffAreaAccess[];
    actionOverrides: { action: string; effect: "ALLOW" | "DENY" }[];
    updatedAt: string | null;
    updatedBy: string | null;
};

export type DeviceInfo = {
    flavor: "main" | "replica";
    isMainDevice: boolean;
    placements: [MainOnlyOperation, Placement][];
    mainLink: { linked: boolean; userId: string | null };
};

export const getDeviceInfo = () => practiceSystem.invoke<DeviceInfo>("device_info");
export const getAccessCatalog = () => practiceSystem.invoke<AccessCatalog>("access_catalog");
export const getStaffAccess = (staffId: string) => practiceSystem.invoke<StaffAccess>("staff_access_get", { staffId });

/** `grants`: areas changed from the role, e.g. `{ cash_desk: "view" }`. */
export const setStaffAccess = (staffId: string, template: string, grants: Partial<Record<AccessAreaId, AccessLevel>>) =>
    practiceSystem.invoke<StaffAccess>("staff_access_set", { staffId, request: { template, grants } });

export const resetStaffAccess = (staffId: string) => practiceSystem.invoke<StaffAccess>("staff_access_reset", { staffId });

export const setStaffScopes = (staffId: string, ownAreas: AccessAreaId[]) =>
    practiceSystem.invoke<StaffAccess>("staff_access_set_scopes", { staffId, ownAreas });

/** Areas limited to the person's own records (stored as `scope.own.<area>`). */
export function ownScopes(access: Pick<StaffAccess, "actionOverrides">): AccessAreaId[] {
    return access.actionOverrides
        .filter((o) => o.effect === "ALLOW" && o.action.startsWith("scope.own."))
        .map((o) => o.action.slice("scope.own.".length) as AccessAreaId);
}

export function placementOf(info: DeviceInfo | null, op: MainOnlyOperation): Placement {
    return info?.placements.find(([o]) => o === op)?.[1] ?? "local";
}
