import { tauriInvoke } from "@/services/tauri.service";
import type { Bilanz, Zahlung, ZahlungsArt, ZahlungsStatus } from "@/models/types";

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
    behandlung_id?: string | null;
    untersuchung_id?: string | null;
    betrag_erwartet?: number | null;
}): Promise<Zahlung> {
    return tauriInvoke<Zahlung>("create_zahlung", { data });
}

export async function updateZahlungStatus(id: string, status: ZahlungsStatus): Promise<Zahlung> {
    return tauriInvoke<Zahlung>("update_zahlung_status", { id, status });
}

export async function updateZahlung(data: {
    id: string;
    betrag: number;
    zahlungsart: ZahlungsArt;
    leistung_id?: string | null;
    beschreibung?: string | null;
}): Promise<Zahlung> {
    return tauriInvoke<Zahlung>("update_zahlung", { data });
}

export async function deleteZahlung(id: string): Promise<void> {
    return tauriInvoke<void>("delete_zahlung", { id });
}

/** Tagesabschluss: markiert ausgewählte Zahlungen als kassengeprüft (oder zurück). */
export async function setZahlungenKasseGeprueft(ids: string[], kasseGeprueft: boolean): Promise<number> {
    return tauriInvoke<number>("set_zahlungen_kasse_geprueft", { ids, kasse_geprueft: kasseGeprueft });
}
