import { tauriInvoke } from "../services/tauri.service";
import type {
    Patientenakte,
    Zahnbefund,
    Anamnesebogen,
    Behandlung,
    Untersuchung,
} from "../models/types";

export async function getAkte(patientId: string): Promise<Patientenakte> {
    return tauriInvoke<Patientenakte>("get_akte", { patientId });
}

export async function listZahnbefunde(akteId: string): Promise<Zahnbefund[]> {
    return tauriInvoke<Zahnbefund[]>("list_zahnbefunde", { akteId });
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
    return tauriInvoke<Anamnesebogen | null>("get_anamnesebogen", { patientId });
}

export async function saveAnamnesebogen(data: {
    patient_id: string;
    antworten: unknown;
    unterschrieben: boolean;
}): Promise<Anamnesebogen> {
    return tauriInvoke<Anamnesebogen>("save_anamnesebogen", { data });
}

export async function exportAktePdf(patientId: string): Promise<string> {
    return tauriInvoke<string>("export_akte_pdf", { patientId });
}

export async function listBehandlungen(akteId: string): Promise<Behandlung[]> {
    return tauriInvoke<Behandlung[]>("list_behandlungen", { akteId });
}

export async function listUntersuchungen(akteId: string): Promise<Untersuchung[]> {
    return tauriInvoke<Untersuchung[]>("list_untersuchungen", { akteId });
}

export async function createBehandlung(data: {
    akte_id: string;
    art: string;
    beschreibung?: string | null;
    zaehne?: string | null;
    material?: string | null;
    notizen?: string | null;
}): Promise<Behandlung> {
    return tauriInvoke<Behandlung>("create_behandlung", { data });
}

export async function createUntersuchung(data: {
    akte_id: string;
    beschwerden?: string | null;
    ergebnisse?: string | null;
    diagnose?: string | null;
}): Promise<Untersuchung> {
    return tauriInvoke<Untersuchung>("create_untersuchung", { data });
}
