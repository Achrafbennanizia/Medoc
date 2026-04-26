import { tauriInvoke } from "@/services/tauri.service";

export interface TagesabschlussProtokoll {
    id: string;
    stichtag: string;
    gezaehlt_eur: number | null;
    bar_laut_system_eur: number;
    einnahmen_laut_system_eur: number;
    abweichung_eur: number | null;
    bar_stimmt: number;
    anzahl_zahlungen_tag: number;
    anzahl_kasse_geprueft: number;
    alle_zahlungen_geprueft: number;
    notiz: string | null;
    protokolliert_at: string;
}

export interface CreateTagesabschlussProtokoll {
    stichtag: string;
    gezaehlt_eur: number | null;
    bar_laut_system_eur: number;
    einnahmen_laut_system_eur: number;
    abweichung_eur: number | null;
    bar_stimmt: number;
    anzahl_zahlungen_tag: number;
    anzahl_kasse_geprueft: number;
    alle_zahlungen_geprueft: number;
    notiz: string | null;
}

export const listTagesabschlussProtokolle = () =>
    tauriInvoke<TagesabschlussProtokoll[]>("list_tagesabschluss_protokolle");

export const getTagesabschlussProtokoll = (id: string) =>
    tauriInvoke<TagesabschlussProtokoll>("get_tagesabschluss_protokoll", { id });

export const createTagesabschlussProtokoll = (data: CreateTagesabschlussProtokoll) =>
    tauriInvoke<TagesabschlussProtokoll>("create_tagesabschluss_protokoll", { data });

export const deleteTagesabschlussProtokoll = (id: string) =>
    tauriInvoke<void>("delete_tagesabschluss_protokoll", { id });
