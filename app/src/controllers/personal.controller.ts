import { tauriInvoke } from "@/services/tauri.service";
import type { PermissionOverride, Personal, Rolle } from "@/models/types";
import { CreatePersonalSchema, UpdatePersonalSchema, UpdateOwnProfileSchema, parseOrThrow } from "@/lib/schemas";

/** Antwort von `get_own_profile` / `update_own_profile` (ohne Passwort-Hash). */
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
    return tauriInvoke<OwnProfileDto>("get_own_profile");
}

export async function updateOwnProfile(data: Record<string, unknown>): Promise<OwnProfileDto> {
    const safe = parseOrThrow(UpdateOwnProfileSchema, data);
    return tauriInvoke<OwnProfileDto>("update_own_profile", { data: safe });
}

/** Doctors (role ARZT) for appointment assignment — visible to Arzt + Rezeption. */
export interface AerztSummary {
    id: string;
    name: string;
}

export async function listAerzte(): Promise<AerztSummary[]> {
    return tauriInvoke<AerztSummary[]>("list_aerzte");
}

export async function listPersonal(): Promise<Personal[]> {
    return tauriInvoke<Personal[]>("list_personal");
}

export async function getPersonal(id: string): Promise<Personal> {
    return tauriInvoke<Personal>("get_personal", { id });
}

export async function createPersonal(data: {
    name: string;
    email: string;
    passwort: string;
    rolle: string;
}): Promise<Personal> {
    const safe = parseOrThrow(CreatePersonalSchema, data);
    return tauriInvoke<Personal>("create_personal", { data: safe });
}

export async function updatePersonal(id: string, data: Record<string, unknown>): Promise<Personal> {
    const safe = parseOrThrow(UpdatePersonalSchema, data);
    return tauriInvoke<Personal>("update_personal", { id, data: safe });
}

export async function deletePersonal(id: string): Promise<void> {
    return tauriInvoke("delete_personal", { id });
}

/** Setzt das Passwort für ein Team-Mitglied (Personalverwaltung, ohne altes Passwort). */
export async function setPersonalPasswordByAdmin(
    id: string,
    newPassword: string,
): Promise<void> {
    return tauriInvoke("set_personal_password_by_admin", { id, new_password: newPassword });
}

/** FA-PERS-07 */
export async function listPersonalPermissionOverrides(personalId: string): Promise<PermissionOverride[]> {
    return tauriInvoke<PermissionOverride[]>("list_personal_permission_overrides", { personal_id: personalId });
}

export async function setPersonalPermissionOverride(
    personalId: string,
    action: string,
    effect: "ALLOW" | "DENY",
): Promise<void> {
    return tauriInvoke("set_personal_permission_override", {
        personal_id: personalId,
        action,
        effect,
    });
}

export async function deletePersonalPermissionOverride(personalId: string, action: string): Promise<void> {
    return tauriInvoke("delete_personal_permission_override", { personal_id: personalId, action });
}
