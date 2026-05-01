import { tauriInvoke } from "../services/tauri.service";
import type { AkteAnlageRowDto } from "../lib/akte-anlagen";
import type {
    Patientenakte,
    Zahnbefund,
    Anamnesebogen,
    Behandlung,
    Untersuchung,
} from "../models/types";

export async function getAkte(patientId: string): Promise<Patientenakte> {
    return tauriInvoke<Patientenakte>("get_akte", { patient_id: patientId });
}

export async function listZahnbefunde(akteId: string): Promise<Zahnbefund[]> {
    return tauriInvoke<Zahnbefund[]>("list_zahnbefunde", { akte_id: akteId });
}

export async function createZahnbefund(data: {
    akte_id: string;
    zahn_nummer: number;
    befund: string;
    diagnose?: string;
    notizen?: string;
}): Promise<Zahnbefund> {
    return tauriInvoke<Zahnbefund>("update_zahnbefund", { data });
}

export async function getAnamnesebogen(patientId: string): Promise<Anamnesebogen | null> {
    return tauriInvoke<Anamnesebogen | null>("get_anamnesebogen", { patient_id: patientId });
}

export async function saveAnamnesebogen(data: {
    patient_id: string;
    antworten: unknown;
    unterschrieben: boolean;
}): Promise<Anamnesebogen> {
    return tauriInvoke<Anamnesebogen>("save_anamnesebogen", { data });
}

export async function exportAktePdf(patientId: string): Promise<string> {
    return tauriInvoke<string>("export_akte_pdf", { patient_id: patientId });
}

export async function listBehandlungen(akteId: string): Promise<Behandlung[]> {
    return tauriInvoke<Behandlung[]>("list_behandlungen", { akte_id: akteId });
}

export async function listUntersuchungen(akteId: string): Promise<Untersuchung[]> {
    return tauriInvoke<Untersuchung[]>("list_untersuchungen", { akte_id: akteId });
}

export async function createBehandlung(data: {
    akte_id: string;
    art: string;
    beschreibung?: string | null;
    zaehne?: string | null;
    material?: string | null;
    notizen?: string | null;
    kategorie?: string | null;
    leistungsname?: string | null;
    behandlungsnummer?: string | null;
    sitzung?: number | null;
    behandlung_status?: string | null;
    gesamtkosten?: number | null;
    termin_erforderlich?: boolean | null;
    behandlung_datum?: string | null;
}): Promise<Behandlung> {
    return tauriInvoke<Behandlung>("create_behandlung", { data });
}

export async function createUntersuchung(data: {
    akte_id: string;
    beschwerden?: string | null;
    ergebnisse?: string | null;
    diagnose?: string | null;
    untersuchungsnummer?: string | null;
}): Promise<Untersuchung> {
    return tauriInvoke<Untersuchung>("create_untersuchung", { data });
}

export async function updateUntersuchung(data: {
    id: string;
    beschwerden?: string | null;
    ergebnisse?: string | null;
    diagnose?: string | null;
}): Promise<Untersuchung> {
    return tauriInvoke<Untersuchung>("update_untersuchung", { data });
}

export async function deleteUntersuchung(id: string): Promise<void> {
    return tauriInvoke<void>("delete_untersuchung", { id });
}

export async function updateBehandlung(data: {
    id: string;
    art: string;
    beschreibung?: string | null;
    zaehne?: string | null;
    material?: string | null;
    notizen?: string | null;
    kategorie?: string | null;
    leistungsname?: string | null;
    behandlungsnummer?: string | null;
    sitzung?: number | null;
    behandlung_status?: string | null;
    gesamtkosten?: number | null;
    termin_erforderlich?: boolean | null;
    behandlung_datum?: string | null;
}): Promise<Behandlung> {
    return tauriInvoke<Behandlung>("update_behandlung", { data });
}

export async function deleteBehandlung(id: string): Promise<void> {
    return tauriInvoke<void>("delete_behandlung", { id });
}

export async function listAkteAnlagen(akteId: string): Promise<AkteAnlageRowDto[]> {
    return tauriInvoke<AkteAnlageRowDto[]>("list_akte_anlagen", { akte_id: akteId });
}

export async function createAkteAnlage(data: {
    akte_id: string;
    display_name: string;
    mime_type: string;
    bytes_base64: string;
}): Promise<AkteAnlageRowDto> {
    return tauriInvoke<AkteAnlageRowDto>("create_akte_anlage", { data });
}

export async function deleteAkteAnlage(id: string): Promise<void> {
    return tauriInvoke<void>("delete_akte_anlage", { id });
}

export async function renameAkteAnlage(id: string, displayName: string): Promise<void> {
    return tauriInvoke<void>("rename_akte_anlage", { id, display_name: displayName });
}

export async function openAkteAnlageExternally(id: string, withApp?: string | null): Promise<void> {
    return tauriInvoke<void>("open_akte_anlage_externally", {
        id,
        with_app: withApp !== undefined && withApp !== null && withApp.trim() !== "" ? withApp : null,
    });
}

export async function duplicateAkteAnlage(id: string): Promise<AkteAnlageRowDto> {
    return tauriInvoke<AkteAnlageRowDto>("duplicate_akte_anlage", { id });
}
