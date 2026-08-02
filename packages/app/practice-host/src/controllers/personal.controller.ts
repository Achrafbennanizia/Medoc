import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { PermissionOverride, Personal, Rolle } from "@/models/types";
import { CreatePersonalSchema, UpdatePersonalSchema, UpdateOwnProfileSchema, parseOrThrow } from "@/lib/schemas";

/** Response from `get_own_profile` / `update_own_profile` (without password hash). */
export interface OwnProfileDto {
    user_id: string;
    name: string;
    email: string;
    rolle: Rolle;
    taetigkeitsbereich: string | null;
    fachrichtung: string | null;
    telefon: string | null;
}

export async function getOwnProfile(): Promise<OwnProfileDto> {
    return practiceSystem.invoke<OwnProfileDto>("get_own_profile");
}

export async function updateOwnProfile(data: Record<string, unknown>): Promise<OwnProfileDto> {
    const safe = parseOrThrow(UpdateOwnProfileSchema, data);
    return practiceSystem.invoke<OwnProfileDto>("update_own_profile", { data: safe });
}

/** Doctors (role ARZT) for appointment assignment — visible to physician + reception roles. */
export interface AerztSummary {
    id: string;
    name: string;
}

export async function listAerzte(): Promise<AerztSummary[]> {
    return practiceSystem.invoke<AerztSummary[]>("list_aerzte");
}

/** Physician/reception names for practice tasks — allowed with `aufgabe.status.fulfill` (no HR read). */
export interface AufgabeTeamMember {
    id: string;
    name: string;
    rolle: Rolle;
}

export async function listAufgabeTeamDirectory(): Promise<AufgabeTeamMember[]> {
    return practiceSystem.invoke<AufgabeTeamMember[]>("list_aufgabe_team_directory");
}

export async function listPersonal(): Promise<Personal[]> {
    return practiceSystem.invoke<Personal[]>("list_personal");
}

export async function getPersonal(id: string): Promise<Personal> {
    return practiceSystem.invoke<Personal>("get_personal", { id });
}

export async function createPersonal(data: {
    name: string;
    email: string;
    passwort: string;
    rolle: string;
}): Promise<Personal> {
    const safe = parseOrThrow(CreatePersonalSchema, data);
    return practiceSystem.invoke<Personal>("create_personal", { data: safe });
}

export async function updatePersonal(id: string, data: Record<string, unknown>): Promise<Personal> {
    const safe = parseOrThrow(UpdatePersonalSchema, data);
    return practiceSystem.invoke<Personal>("update_personal", { id, data: safe });
}

export async function deletePersonal(id: string): Promise<void> {
    return practiceSystem.invoke("delete_personal", { id });
}

/** Sets password for a team member (staff management, without old password). */
export async function setPersonalPasswordByAdmin(
    id: string,
    newPassword: string,
): Promise<void> {
    return practiceSystem.invoke("set_personal_password_by_admin", { id, new_password: newPassword });
}

/** FA-PERS-07 */
export async function listPersonalPermissionOverrides(personalId: string): Promise<PermissionOverride[]> {
    return practiceSystem.invoke<PermissionOverride[]>("list_personal_permission_overrides", { personal_id: personalId });
}

export async function setPersonalPermissionOverride(
    personalId: string,
    action: string,
    effect: "ALLOW" | "DENY",
): Promise<void> {
    return practiceSystem.invoke("set_personal_permission_override", {
        personal_id: personalId,
        action,
        effect,
    });
}

export async function deletePersonalPermissionOverride(personalId: string, action: string): Promise<void> {
    return practiceSystem.invoke("delete_personal_permission_override", { personal_id: personalId, action });
}

/** Clears all overrides — the role applies again without deviations. */
export async function resetPersonalPermissionOverrides(personalId: string): Promise<number> {
    return practiceSystem.invoke<number>("reset_personal_permission_overrides", { personal_id: personalId });
}

/** ALLOW for each RBAC action from `config/rbac.yaml`. */
export async function grantPersonalAllPermissions(personalId: string): Promise<number> {
    return practiceSystem.invoke<number>("grant_personal_all_permissions", { personal_id: personalId });
}

/** Unlocks brute-force lock for a team member (admin). */
export async function adminUnlockBruteForce(targetEmail: string): Promise<number> {
    return practiceSystem.invoke<number>("admin_unlock_brute_force", { target_email: targetEmail.trim() });
}

export interface StaffQuota {
    max_arzt: number;
    max_rezeption: number;
    max_total: number;
    used_arzt: number;
    used_rezeption: number;
    used_total: number;
}

export async function getStaffQuota(): Promise<StaffQuota> {
    return practiceSystem.invoke<StaffQuota>("get_staff_quota");
}
