import { tauriInvoke } from "@/services/tauri.service";
import type { Personal } from "@/models/types";

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

export async function createPersonal(data: {
    name: string;
    email: string;
    passwort: string;
    rolle: string;
}): Promise<Personal> {
    return tauriInvoke<Personal>("create_personal", { data });
}

export async function updatePersonal(id: string, data: Record<string, unknown>): Promise<Personal> {
    return tauriInvoke<Personal>("update_personal", { id, data });
}

export async function deletePersonal(id: string): Promise<void> {
    return tauriInvoke("delete_personal", { id });
}
