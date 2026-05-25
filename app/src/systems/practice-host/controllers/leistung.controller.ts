import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { Leistung } from "@/models/types";
import { CreateLeistungSchema, UpdateLeistungSchema, parseOrThrow, type UpdateLeistungInput } from "@/lib/schemas";

export async function listLeistungen(): Promise<Leistung[]> {
    return practiceSystem.invoke<Leistung[]>("list_leistungen");
}

export async function createLeistung(data: {
    name: string;
    beschreibung?: string;
    kategorie: string;
    preis: number;
}): Promise<Leistung> {
    const safe = parseOrThrow(CreateLeistungSchema, data);
    return practiceSystem.invoke<Leistung>("create_leistung", { data: safe });
}

/** Fields mirror Tauri `UpdateLeistung` — all optional, merged with existing row. */
export type UpdateLeistungPayload = UpdateLeistungInput;

export async function updateLeistung(id: string, data: UpdateLeistungPayload): Promise<Leistung> {
    const safe = parseOrThrow(UpdateLeistungSchema, data);
    return practiceSystem.invoke<Leistung>("update_leistung", { id, data: safe });
}

export async function deleteLeistung(id: string): Promise<void> {
    return practiceSystem.invoke("delete_leistung", { id });
}
