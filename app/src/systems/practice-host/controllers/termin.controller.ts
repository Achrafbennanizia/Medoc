import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { Termin } from "@/models/types";
import {
    CreateTerminSchema,
    UpdateTerminSchema,
    parseOrThrow,
} from "@/lib/schemas";

export async function listTermine(): Promise<Termin[]> {
    return practiceSystem.invoke<Termin[]>("list_termine");
}

export async function listTermineByDate(datum: string): Promise<Termin[]> {
    return practiceSystem.invoke<Termin[]>("list_termine_by_date", { datum });
}

export async function getTermin(id: string): Promise<Termin> {
    return practiceSystem.invoke<Termin>("get_termin", { id });
}

export async function createTermin(data: {
    datum: string;
    uhrzeit: string;
    art: string;
    patient_id: string;
    arzt_id: string;
    /** Freitext / Dauer / interne Hinweise (Rust `CreateTermin.notizen`). */
    notizen?: string | null;
    beschwerden?: string | null;
}): Promise<Termin> {
    const safe = parseOrThrow(CreateTerminSchema, data);
    return practiceSystem.invoke<Termin>("create_termin", { data: safe });
}

export async function updateTermin(id: string, data: Record<string, unknown>): Promise<Termin> {
    const safe = parseOrThrow(UpdateTerminSchema, data);
    return practiceSystem.invoke<Termin>("update_termin", { id, data: safe });
}

export async function deleteTermin(id: string): Promise<void> {
    return practiceSystem.invoke("delete_termin", { id });
}
