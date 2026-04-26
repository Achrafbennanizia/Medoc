import { tauriInvoke } from "@/services/tauri.service";
import { CreateBestellungSchema, UpdateBestellungSchema, parseOrThrow } from "@/lib/schemas";

export type BestellStatus = "OFFEN" | "UNTERWEGS" | "GELIEFERT" | "STORNIERT";

export interface Bestellung {
    id: string;
    bestellnummer: string | null;
    lieferant: string;
    pharmaberater: string | null;
    artikel: string;
    status: BestellStatus;
    erwartet_am: string | null;
    geliefert_am: string | null;
    menge: number;
    einheit: string | null;
    bemerkung: string | null;
    /** Auftragssumme bei Erfassung (Lager-Preis × Menge), für Finanzen. */
    gesamtbetrag?: number | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface CreateBestellung {
    lieferant: string;
    artikel: string;
    erwartet_am?: string | null;
    menge: number;
    einheit?: string | null;
    bemerkung?: string | null;
    bestellnummer?: string | null;
    pharmaberater?: string | null;
    gesamtbetrag?: number | null;
}

/** Patch DTO. Each field is optional; only provided fields are updated. */
export interface UpdateBestellung {
    lieferant?: string;
    artikel?: string;
    menge?: number;
    einheit?: string | null;
    erwartet_am?: string | null;
    bemerkung?: string | null;
    bestellnummer?: string | null;
    pharmaberater?: string | null;
}

export const listBestellungen = () =>
    tauriInvoke<Bestellung[]>("list_bestellungen");

export const createBestellung = (data: CreateBestellung) => {
    const safe = parseOrThrow(CreateBestellungSchema, data);
    return tauriInvoke<Bestellung>("create_bestellung", { data: safe });
};

export const updateBestellung = (id: string, data: UpdateBestellung) => {
    const safe = parseOrThrow(UpdateBestellungSchema, data);
    return tauriInvoke<Bestellung>("update_bestellung", { id, data: safe });
};

export const updateBestellungStatus = (id: string, status: BestellStatus) =>
    tauriInvoke<Bestellung>("update_bestellung_status", { id, status });

export const deleteBestellung = (id: string) =>
    tauriInvoke<void>("delete_bestellung", { id });
