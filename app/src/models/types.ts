// ===== Domain Types (mirrored from Rust backend) =====

export type Rolle = "ARZT" | "REZEPTION" | "STEUERBERATER" | "PHARMABERATER";
export type TerminArt = "ERSTBESUCH" | "UNTERSUCHUNG" | "BEHANDLUNG" | "KONTROLLE" | "BERATUNG";
export type TerminStatus = "GEPLANT" | "BESTAETIGT" | "DURCHGEFUEHRT" | "NICHT_ERSCHIENEN" | "ABGESAGT";
export type Geschlecht = "MAENNLICH" | "WEIBLICH" | "DIVERS";
export type PatientStatus = "NEU" | "AKTIV" | "VALIDIERT" | "READONLY";
export type AktenStatus = "ENTWURF" | "IN_BEARBEITUNG" | "VALIDIERT" | "READONLY";
export type ZahlungsArt = "BAR" | "KARTE" | "UEBERWEISUNG" | "RECHNUNG";
export type ZahlungsStatus = "AUSSTEHEND" | "BEZAHLT" | "TEILBEZAHLT" | "STORNIERT";

export interface Session {
    user_id: string;
    name: string;
    email: string;
    rolle: Rolle;
}

export interface Personal {
    id: string;
    name: string;
    email: string;
    rolle: Rolle;
    taetigkeitsbereich: string | null;
    fachrichtung: string | null;
    telefon: string | null;
    verfuegbar: boolean;
    created_at: string;
    updated_at: string;
}

export interface Patient {
    id: string;
    name: string;
    geburtsdatum: string;
    geschlecht: Geschlecht;
    versicherungsnummer: string;
    telefon: string | null;
    email: string | null;
    adresse: string | null;
    status: PatientStatus;
    created_at: string;
    updated_at: string;
}

export interface Termin {
    id: string;
    datum: string;
    uhrzeit: string;
    art: TerminArt;
    status: TerminStatus;
    notizen: string | null;
    beschwerden: string | null;
    patient_id: string;
    arzt_id: string;
    created_at: string;
    updated_at: string;
}

export interface Patientenakte {
    id: string;
    patient_id: string;
    status: AktenStatus;
    diagnose: string | null;
    befunde: string | null;
    created_at: string;
    updated_at: string;
}

export interface Zahnbefund {
    id: string;
    akte_id: string;
    zahn_nummer: number;
    befund: string;
    diagnose: string | null;
    notizen: string | null;
    created_at: string;
    updated_at: string;
}

export interface Anamnesebogen {
    id: string;
    patient_id: string;
    antworten: string;
    unterschrieben: boolean;
    created_at: string;
    updated_at: string;
}

export interface Untersuchung {
    id: string;
    akte_id: string;
    beschwerden: string | null;
    ergebnisse: string | null;
    diagnose: string | null;
    created_at: string;
}

export interface Behandlung {
    id: string;
    akte_id: string;
    art: string;
    beschreibung: string | null;
    zaehne: string | null;
    material: string | null;
    notizen: string | null;
    created_at: string;
}

export interface Zahlung {
    id: string;
    patient_id: string;
    betrag: number;
    zahlungsart: ZahlungsArt;
    status: ZahlungsStatus;
    leistung_id: string | null;
    beschreibung: string | null;
    created_at: string;
}

export interface Bilanz {
    einnahmen: number;
    ausstehend: number;
    storniert: number;
    anzahl_zahlungen: number;
}

export interface Leistung {
    id: string;
    name: string;
    beschreibung: string | null;
    kategorie: string;
    preis: number;
    aktiv: boolean;
    created_at: string;
    updated_at: string;
}

export interface Produkt {
    id: string;
    name: string;
    beschreibung: string | null;
    kategorie: string;
    preis: number;
    bestand: number;
    mindestbestand: number;
    aktiv: boolean;
    created_at: string;
    updated_at: string;
}

export interface AuditLog {
    id: string;
    user_id: string;
    action: string;
    entity: string;
    entity_id: string | null;
    details: string | null;
    created_at: string;
}

/** Mirrors `get_dashboard_stats` — fields are null when the role lacks permission. */
export interface DashboardStats {
    patienten_gesamt: number | null;
    termine_heute: number | null;
    einnahmen_monat: number | null;
    produkte_niedrig: number | null;
}
