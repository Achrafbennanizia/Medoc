import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { Produkt } from "@/models/types";

export async function listProdukte(): Promise<Produkt[]> {
    return practiceSystem.invoke<Produkt[]>("list_produkte");
}

export async function createProdukt(data: {
    name: string;
    beschreibung?: string;
    kategorie: string;
    preis: number;
    bestand: number;
    mindestbestand: number;
}): Promise<Produkt> {
    return practiceSystem.invoke<Produkt>("create_produkt", { data });
}

export type UpdateProduktPayload = {
    name?: string;
    beschreibung?: string | null;
    kategorie?: string;
    preis?: number;
    bestand?: number;
    mindestbestand?: number;
    aktiv?: boolean;
};

export async function updateProdukt(id: string, data: UpdateProduktPayload): Promise<Produkt> {
    return practiceSystem.invoke<Produkt>("update_produkt", { id, data });
}

export async function deleteProdukt(id: string): Promise<void> {
    return practiceSystem.invoke("delete_produkt", { id });
}
