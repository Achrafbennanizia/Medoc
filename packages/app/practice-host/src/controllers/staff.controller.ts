import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { PermissionOverride, Staff, Role } from "@/models/types";
import { CreateStaffSchema, UpdateStaffSchema, UpdateOwnProfileSchema, parseOrThrow } from "@/lib/schemas";

/** Response from `get_own_profile` / `update_own_profile` (without password hash). */
export interface OwnProfileDto {
    user_id: string;
    name: string;
    email: string;
    role: Role;
    activity_area: string | null;
    specialty: string | null;
    phone: string | null;
}

export async function getOwnProfile(): Promise<OwnProfileDto> {
    return practiceSystem.invoke<OwnProfileDto>("get_own_profile");
}

export async function updateOwnProfile(data: Record<string, unknown>): Promise<OwnProfileDto> {
    const safe = parseOrThrow(UpdateOwnProfileSchema, data);
    return practiceSystem.invoke<OwnProfileDto>("update_own_profile", { data: safe });
}

/** Doctors (role PHYSICIAN) for appointment assignment — visible to physician + reception roles. */
export interface PhysicianSummary {
    id: string;
    name: string;
}

export async function listPhysicians(): Promise<PhysicianSummary[]> {
    return practiceSystem.invoke<PhysicianSummary[]>("list_physicians");
}

/** Physician/reception names for practice tasks — allowed with `task.status.fulfill` (no HR read). */
export interface TaskTeamMember {
    id: string;
    name: string;
    role: Role;
}

export async function listTaskTeamDirectory(): Promise<TaskTeamMember[]> {
    return practiceSystem.invoke<TaskTeamMember[]>("list_task_team_directory");
}

export async function listStaff(): Promise<Staff[]> {
    return practiceSystem.invoke<Staff[]>("list_staff");
}

export async function getStaff(id: string): Promise<Staff> {
    return practiceSystem.invoke<Staff>("get_staff", { id });
}

export async function createStaff(data: {
    name: string;
    email: string;
    password: string;
    role: string;
}): Promise<Staff> {
    const safe = parseOrThrow(CreateStaffSchema, data);
    return practiceSystem.invoke<Staff>("create_staff", { data: safe });
}

export async function updateStaff(id: string, data: Record<string, unknown>): Promise<Staff> {
    const safe = parseOrThrow(UpdateStaffSchema, data);
    return practiceSystem.invoke<Staff>("update_staff", { id, data: safe });
}

export async function deleteStaff(id: string): Promise<void> {
    return practiceSystem.invoke("delete_staff", { id });
}

/** Sets password for a team member (staff management, without old password). */
export async function setStaffPasswordByAdmin(
    id: string,
    newPassword: string,
): Promise<void> {
    return practiceSystem.invoke("set_staff_password_by_admin", { id, new_password: newPassword });
}

/** FA-PERS-07 */
export async function listStaffPermissionOverrides(staffId: string): Promise<PermissionOverride[]> {
    return practiceSystem.invoke<PermissionOverride[]>("list_staff_permission_overrides", { staff_id: staffId });
}

export async function setStaffPermissionOverride(
    staffId: string,
    action: string,
    effect: "ALLOW" | "DENY",
): Promise<void> {
    return practiceSystem.invoke("set_staff_permission_override", {
        staff_id: staffId,
        action,
        effect,
    });
}

export async function deleteStaffPermissionOverride(staffId: string, action: string): Promise<void> {
    return practiceSystem.invoke("delete_staff_permission_override", { staff_id: staffId, action });
}

/** Clears all overrides — the role applies again without deviations. */
export async function resetStaffPermissionOverrides(staffId: string): Promise<number> {
    return practiceSystem.invoke<number>("reset_staff_permission_overrides", { staff_id: staffId });
}

/** Full patient chart visible, clinical edits denied (FA-PERS-07 preset). */
export async function setStaffFullChartReadonly(staffId: string, enabled: boolean): Promise<void> {
    return practiceSystem.invoke("set_staff_full_chart_readonly", {
        staff_id: staffId,
        enabled,
    });
}

/** ALLOW for each RBAC action from `config/rbac.yaml`. */
export async function grantStaffAllPermissions(staffId: string): Promise<number> {
    return practiceSystem.invoke<number>("grant_staff_all_permissions", { staff_id: staffId });
}

/** Unlocks brute-force lock for a team member (admin). */
export async function adminUnlockBruteForce(targetEmail: string): Promise<number> {
    return practiceSystem.invoke<number>("admin_unlock_brute_force", { target_email: targetEmail.trim() });
}

export interface StaffQuota {
    max_physician: number;
    max_reception: number;
    max_total: number;
    used_physician: number;
    used_reception: number;
    used_total: number;
}

export async function getStaffQuota(): Promise<StaffQuota> {
    return practiceSystem.invoke<StaffQuota>("get_staff_quota");
}
