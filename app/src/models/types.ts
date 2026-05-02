// ===== Domain Types (mirrored from Rust backend `app/src-tauri/src/domain/`) =====

/** Personae — serde `Rolle` UPPERCASE. */
export const ROLLE_VALUES = ["ARZT", "REZEPTION", "STEUERBERATER", "PHARMABERATER"] as const;
export type Rolle = (typeof ROLLE_VALUES)[number];

export const GESCHLECHT_VALUES = ["MAENNLICH", "WEIBLICH", "DIVERS"] as const;
export type Geschlecht = (typeof GESCHLECHT_VALUES)[number];

/** `TerminArt` — SQLite `termin.art` CHECK (no NOTFALL; UI uses BEHANDLUNG + Notfall-Notiz). */
export const TERMIN_ART_VALUES = ["ERSTBESUCH", "UNTERSUCHUNG", "BEHANDLUNG", "KONTROLLE", "BERATUNG"] as const;
export type TerminArt = (typeof TERMIN_ART_VALUES)[number];

/** `TerminStatus` — matches SQLite CHECK incl. `NICHT_ERSCHIENEN`. */
export const TERMIN_STATUS_VALUES = ["GEPLANT", "BESTAETIGT", "DURCHGEFUEHRT", "NICHT_ERSCHIENEN", "ABGESAGT"] as const;
export type TerminStatus = (typeof TERMIN_STATUS_VALUES)[number];

export const PATIENT_STATUS_VALUES = ["NEU", "AKTIV", "VALIDIERT", "READONLY"] as const;
export type PatientStatus = (typeof PATIENT_STATUS_VALUES)[number];

export const AKTEN_STATUS_VALUES = ["ENTWURF", "IN_BEARBEITUNG", "VALIDIERT", "READONLY"] as const;
export type AktenStatus = (typeof AKTEN_STATUS_VALUES)[number];

export const ZAHLUNGS_ART_VALUES = ["BAR", "KARTE", "UEBERWEISUNG", "RECHNUNG"] as const;
export type ZahlungsArt = (typeof ZAHLUNGS_ART_VALUES)[number];

/** Rust `ZahlungsStatus`: Ausstehend, Bezahlt, Teilbezahlt, Storniert → UPPERCASE. */
export const ZAHLUNGS_STATUS_VALUES = ["AUSSTEHEND", "BEZAHLT", "TEILBEZAHLT", "STORNIERT"] as const;
export type ZahlungsStatus = (typeof ZAHLUNGS_STATUS_VALUES)[number];

/** Bestellung lifecycle (`bestellung.status` CHECK). */
export const BESTELL_STATUS_VALUES = ["OFFEN", "UNTERWEGS", "GELIEFERT", "STORNIERT"] as const;
export type BestellStatus = (typeof BESTELL_STATUS_VALUES)[number];

/** `feedback.kategorie` CHECK (lowercase). */
export const FEEDBACK_KATEGORIE_VALUES = ["feedback", "vigilance", "technical"] as const;
export type FeedbackKategorie = (typeof FEEDBACK_KATEGORIE_VALUES)[number];

/** `feedback.status` CHECK. */
export const FEEDBACK_STATUS_VALUES = ["OFFEN", "BEARBEITUNG", "ERLEDIGT"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUS_VALUES)[number];

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
    untersuchungsnummer?: string | null;
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
    kategorie?: string | null;
    leistungsname?: string | null;
    behandlungsnummer?: string | null;
    sitzung?: number | null;
    behandlung_status?: string | null;
    gesamtkosten?: number | null;
    termin_erforderlich?: number | null;
    behandlung_datum?: string | null;
}

/** Verwaltung: vordefinierte Behandlungsleistungen für Akten-Formulare (`behandlungs_katalog`). */
export interface BehandlungsKatalogItem {
    id: string;
    kategorie: string;
    name: string;
    default_kosten: number | null;
    sort_order: number;
    aktiv: number;
    created_at: string;
}

/** Verwaltung: Stammdaten für Bestellungen (`lieferant_stamm` / `pharmaberater_stamm`). */
export interface LieferantStamm {
    id: string;
    name: string;
    sort_order: number;
    aktiv: number;
    created_at: string;
}

export interface PharmaberaterStamm {
    id: string;
    name: string;
    sort_order: number;
    aktiv: number;
    created_at: string;
}

/** Vordefinierte Kombination Lieferant + Pharmaberater + Produkt (Lager) für „Neue Bestellung“. */
export interface LieferantPharmaVorlage {
    id: string;
    lieferant_id: string;
    pharmaberater_id: string;
    produkt_id: string;
    lieferant_name: string;
    pharmaberater_name: string;
    produkt_name: string;
    produkt_kategorie: string;
    produkt_preis: number;
    /** 0/1 — Produkt im Lager deaktiviert, Schnellwahl-Hinweis in der UI. */
    produkt_aktiv: number;
    sort_order: number;
    aktiv: number;
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
    behandlung_id?: string | null;
    untersuchung_id?: string | null;
    betrag_erwartet?: number | null;
    /** 0/1 — Tagesabschluss: Zahlung kassenseitig geprüft. */
    kasse_geprueft?: number;
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

/** A single bucket in a per-month time series ({@link StatistikOverview}). */
export interface MonthBucket {
    /** `YYYY-MM` (e.g. `"2026-04"`). */
    month: string;
    value: number;
}

/** Generic `(label, value)` pair used by pie & ranking charts. */
export interface LabelValue {
    label: string;
    value: number;
}

/** Aggregated breakdowns powering the rich Statistik page. */
export interface StatistikOverview {
    // Patienten
    patienten_gesamt: number;
    patienten_neu_pro_monat: MonthBucket[];
    patienten_kumuliert_pro_monat: MonthBucket[];
    altersgruppen: LabelValue[];
    geschlechter: LabelValue[];
    patient_status: LabelValue[];
    // Behandlungen
    behandlungen_nach_kategorie: LabelValue[];
    behandlungen_pro_monat: MonthBucket[];
    medikamente_top: LabelValue[];
    // Termine & Organisation
    termine_pro_monat: MonthBucket[];
    termin_status: LabelValue[];
    termin_art: LabelValue[];
    // Finanzen
    einnahmen_pro_monat: MonthBucket[];
    umsatz_nach_zahlungsart: LabelValue[];
    einnahmen_aktueller_monat: number;
    // Bestellungen
    bestellungen_nach_status: LabelValue[];
    bestellungen_pro_monat: MonthBucket[];
    produkte_niedrig: number;
}

/** Practice absences / vacation blocks (`abwesenheit` table). */
export interface Abwesenheit {
    id: string;
    typ: string;
    kommentar: string | null;
    von_tag: string;
    bis_tag: string;
    von_uhrzeit: string | null;
    bis_uhrzeit: string | null;
    created_at: string;
    updated_at: string;
}

/** Admin template for prescriptions or certificates (`dokument_vorlage`). */
export interface DokumentVorlage {
    id: string;
    kind: "REZEPT" | "ATTEST";
    titel: string;
    payload: string;
    created_at: string;
    updated_at: string;
}
