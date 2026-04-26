import { tauriInvoke } from "../services/tauri.service";
import type {
    Abwesenheit,
    BehandlungsKatalogItem,
    DokumentVorlage,
    LieferantPharmaVorlage,
    LieferantStamm,
    PharmaberaterStamm,
} from "../models/types";

export async function listAbwesenheiten(): Promise<Abwesenheit[]> {
    return tauriInvoke<Abwesenheit[]>("list_abwesenheiten");
}

export async function createAbwesenheit(data: {
    typ: string;
    kommentar?: string;
    von_tag: string;
    bis_tag: string;
    von_uhrzeit?: string;
    bis_uhrzeit?: string;
}): Promise<Abwesenheit> {
    return tauriInvoke<Abwesenheit>("create_abwesenheit", { data });
}

export async function updateAbwesenheit(
    id: string,
    data: {
        typ?: string;
        kommentar?: string;
        von_tag?: string;
        bis_tag?: string;
        von_uhrzeit?: string;
        bis_uhrzeit?: string;
    },
): Promise<Abwesenheit> {
    return tauriInvoke<Abwesenheit>("update_abwesenheit", { id, data });
}

export async function deleteAbwesenheit(id: string): Promise<void> {
    return tauriInvoke("delete_abwesenheit", { id });
}

export async function listDokumentVorlagen(): Promise<DokumentVorlage[]> {
    return tauriInvoke<DokumentVorlage[]>("list_dokument_vorlagen");
}

export async function createDokumentVorlage(data: {
    kind: string;
    titel: string;
    payload: Record<string, unknown>;
}): Promise<DokumentVorlage> {
    return tauriInvoke<DokumentVorlage>("create_dokument_vorlage", { data });
}

export async function updateDokumentVorlage(
    id: string,
    data: { titel?: string; payload?: Record<string, unknown> },
): Promise<DokumentVorlage> {
    return tauriInvoke<DokumentVorlage>("update_dokument_vorlage", { id, data });
}

export async function deleteDokumentVorlage(id: string): Promise<void> {
    return tauriInvoke("delete_dokument_vorlage", { id });
}

export async function listBehandlungsKatalog(): Promise<BehandlungsKatalogItem[]> {
    return tauriInvoke<BehandlungsKatalogItem[]>("list_behandlungs_katalog");
}

export async function createBehandlungsKatalogItem(data: {
    kategorie: string;
    name: string;
    default_kosten?: number | null;
    sort_order?: number | null;
}): Promise<BehandlungsKatalogItem> {
    return tauriInvoke<BehandlungsKatalogItem>("create_behandlungs_katalog_item", { data });
}

export async function updateBehandlungsKatalogItem(
    id: string,
    data: {
        kategorie: string;
        name: string;
        default_kosten: number | null;
        sort_order?: number;
    },
): Promise<BehandlungsKatalogItem> {
    return tauriInvoke<BehandlungsKatalogItem>("update_behandlungs_katalog_item", { id, data });
}

export async function deleteBehandlungsKatalogItem(id: string): Promise<void> {
    return tauriInvoke("delete_behandlungs_katalog_item", { id });
}

export async function listLieferantStamm(): Promise<LieferantStamm[]> {
    return tauriInvoke<LieferantStamm[]>("list_lieferant_stamm");
}

export async function createLieferantStamm(data: { name: string; sort_order?: number | null }): Promise<LieferantStamm> {
    return tauriInvoke<LieferantStamm>("create_lieferant_stamm", { data });
}

export async function deleteLieferantStamm(id: string): Promise<void> {
    return tauriInvoke("delete_lieferant_stamm", { id });
}

export async function listPharmaberaterStamm(): Promise<PharmaberaterStamm[]> {
    return tauriInvoke<PharmaberaterStamm[]>("list_pharmaberater_stamm");
}

export async function createPharmaberaterStamm(data: { name: string; sort_order?: number | null }): Promise<PharmaberaterStamm> {
    return tauriInvoke<PharmaberaterStamm>("create_pharmaberater_stamm", { data });
}

export async function deletePharmaberaterStamm(id: string): Promise<void> {
    return tauriInvoke("delete_pharmaberater_stamm", { id });
}

export async function listLieferantPharmaVorlagen(): Promise<LieferantPharmaVorlage[]> {
    return tauriInvoke<LieferantPharmaVorlage[]>("list_lieferant_pharma_vorlagen");
}

export async function createLieferantPharmaVorlage(data: {
    lieferant_id: string;
    pharmaberater_id: string;
    produkt_id: string;
    sort_order?: number | null;
}): Promise<LieferantPharmaVorlage> {
    return tauriInvoke<LieferantPharmaVorlage>("create_lieferant_pharma_vorlage", { data });
}

export async function deleteLieferantPharmaVorlage(id: string): Promise<void> {
    return tauriInvoke("delete_lieferant_pharma_vorlage", { id });
}
