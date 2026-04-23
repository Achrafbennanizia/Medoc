import { tauriInvoke } from "@/services/tauri.service";
import type { Bilanz, Zahlung, ZahlungsStatus } from "@/models/types";

export async function listZahlungen(): Promise<Zahlung[]> {
    return tauriInvoke<Zahlung[]>("list_zahlungen");
}

export async function getBilanz(): Promise<Bilanz> {
    return tauriInvoke<Bilanz>("get_bilanz");
}

export async function createZahlung(data: {
    patient_id: string;
    betrag: number;
    zahlungsart: string;
    leistung_id?: string;
    beschreibung?: string;
}): Promise<Zahlung> {
    return tauriInvoke<Zahlung>("create_zahlung", { data });
}

export async function updateZahlungStatus(id: string, status: ZahlungsStatus): Promise<Zahlung> {
    return tauriInvoke<Zahlung>("update_zahlung_status", { id, status });
}
