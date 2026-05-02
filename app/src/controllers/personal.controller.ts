import { tauriInvoke } from "@/services/tauri.service";
import type { Personal } from "@/models/types";
import { CreatePersonalSchema, UpdatePersonalSchema, parseOrThrow } from "@/lib/schemas";

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
