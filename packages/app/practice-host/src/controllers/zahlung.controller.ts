import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { Bilanz, Zahlung, ZahlungsArt, ZahlungsStatus } from "@/models/types";
import { CreateZahlungSchema, UpdateZahlungSchema, parseOrThrow } from "@/lib/schemas";

export async function listZahlungen(): Promise<Zahlung[]> {
    return practiceSystem.invoke<Zahlung[]>("list_zahlungen");
}

/** Bookings for one Patient only (same right as `list_zahlungen`; less data transfer). */
export async function listZahlungenForPatient(patient_id: string): Promise<Zahlung[]> {
    return practiceSystem.invoke<Zahlung[]>("list_zahlungen_for_patient", { patient_id });
}

/** For patient list: IDs with at least one booking "ausstehend" or "teilbezahlt". */
export async function listPatientIdsOpenInvoice(): Promise<string[]> {
    return practiceSystem.invoke<string[]>("list_patient_ids_open_invoice");
}

export async function getBilanz(): Promise<Bilanz> {
    return practiceSystem.invoke<Bilanz>("get_bilanz");
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
    const safe = parseOrThrow(CreateZahlungSchema, data);
    return practiceSystem.invoke<Zahlung>("create_zahlung", { data: safe });
}

export async function updateZahlungStatus(id: string, status: ZahlungsStatus): Promise<Zahlung> {
    return practiceSystem.invoke<Zahlung>("update_zahlung_status", { id, status });
}

export async function updateZahlung(data: {
    id: string;
    betrag: number;
    zahlungsart: ZahlungsArt;
    leistung_id?: string | null;
    beschreibung?: string | null;
}): Promise<Zahlung> {
    const safe = parseOrThrow(UpdateZahlungSchema, data);
    return practiceSystem.invoke<Zahlung>("update_zahlung", { data: safe });
}

export async function deleteZahlung(id: string): Promise<void> {
    return practiceSystem.invoke<void>("delete_zahlung", { id });
}

/** Tagesabschluss: marks selected payments as cash-verified (or reverts). */
export async function setZahlungenKasseGeprueft(ids: string[], kasseGeprueft: boolean): Promise<number> {
    return practiceSystem.invoke<number>("set_zahlungen_kasse_geprueft", { ids, kasse_geprueft: kasseGeprueft });
}
