import { tauriInvoke } from "@/services/tauri.service";
import type { Produkt } from "@/models/types";

export async function listProdukte(): Promise<Produkt[]> {
    return tauriInvoke<Produkt[]>("list_produkte");
}

export async function createProdukt(data: {
    name: string;
    beschreibung?: string;
    kategorie: string;
    preis: number;
    bestand: number;
    mindestbestand: number;
}): Promise<Produkt> {
    return tauriInvoke<Produkt>("create_produkt", { data });
}

export async function updateProdukt(id: string, data: Record<string, unknown>): Promise<Produkt> {
    return tauriInvoke<Produkt>("update_produkt", { id, data });
}

export async function deleteProdukt(id: string): Promise<void> {
    return tauriInvoke("delete_produkt", { id });
}
