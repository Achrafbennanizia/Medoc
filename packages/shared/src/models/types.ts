// ===== Domain Types (mirrored from Rust backend `app/src-tauri/src/domain/`) =====
// Enum wire values: `config/enums.yaml` → `lib/enums.generated.ts` (via `cargo build`).

export type {
    AktenStatus,
    BestellStatus,
    FeedbackKategorie,
    FeedbackStatus,
    Geschlecht,
    PatientStatus,
    Rolle,
    TerminArt,
    TerminStatus,
    ZahlungsArt,
    ZahlungsStatus,
} from "@/lib/enums.generated";

export {
    AKTEN_STATUS_VALUES,
    BESTELL_STATUS_VALUES,
    FEEDBACK_KATEGORIE_VALUES,
    FEEDBACK_STATUS_VALUES,
    GESCHLECHT_VALUES,
    PATIENT_STATUS_VALUES,
    ROLLE_VALUES,
    TERMIN_ART_VALUES,
    TERMIN_STATUS_VALUES,
    ZAHLUNGS_ART_VALUES,
    ZAHLUNGS_STATUS_VALUES,
} from "@/lib/enums.generated";

import type {
    AktenStatus,
    Geschlecht,
    PatientStatus,
    Rolle,
    TerminArt,
    TerminStatus,
    ZahlungsArt,
    ZahlungsStatus,
} from "@/lib/enums.generated";

/** FA-PERS-07 — granular capability overrides (must match backend `PermissionOverride`). */
export type PermissionOverride = { action: string; effect: "ALLOW" | "DENY" };

export interface Session {
    user_id: string;
    name: string;
    email: string;
    rolle: Rolle;
    permission_overrides?: PermissionOverride[];
    /** Desktop/browser device session (SQLite `device_session`). */
    device_session_id?: string | null;
}

/** Persisted in SQLite `in_app_notification` (notifications for logged-in staff). */
export interface InAppNotification {
    id: string;
    user_id: string;
    kind: string;
    title: string;
    body: string;
    payload_json: string | null;
    read_at: string | null;
    created_at: string;
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
    /** FA-LEIST-07 */
    kategorie?: string | null;
    leistungsname?: string | null;
    gesamtkosten?: number | null;
    /** FA-LEIST-05 */
    freigegeben_von_arzt_id?: string | null;
    freigegeben_am?: string | null;
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
    /** FA-LEIST-05 */
    freigegeben_von_arzt_id?: string | null;
    freigegeben_am?: string | null;
}

/** Admin: predefined treatment services for record forms (`behandlungs_katalog`). */
export interface BehandlungsKatalogItem {
    id: string;
    kategorie: string;
    name: string;
    default_kosten: number | null;
    sort_order: number;
    aktiv: number;
    created_at: string;
}

/** Admin: master data for orders (`lieferant_stamm` / `pharmaberater_stamm`). */
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

/** Predefined combination supplier + pharmaceutical advisor + product (inventory) for new orders. */
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
    /** 0/1 — product deactivated in inventory, quick-select hint in UI. */
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
    /** 0/1 — day-end close: payment cash-verified. */
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
    under_break_glass: boolean;
    break_glass_reason: string | null;
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

/** Aggregated breakdowns powering the rich statistics page. */
export interface StatistikOverview {
    // Patients
    patienten_gesamt: number;
    patienten_neu_pro_monat: MonthBucket[];
    patienten_kumuliert_pro_monat: MonthBucket[];
    altersgruppen: LabelValue[];
    geschlechter: LabelValue[];
    patient_status: LabelValue[];
    // Treatments
    behandlungen_nach_kategorie: LabelValue[];
    behandlungen_pro_monat: MonthBucket[];
    /** WAAD 9.5 — disease patterns (category/type) and monthly course. */
    krankheitsbilder_top: LabelValue[];
    krankheitsbilder_verlauf_pro_monat: MonthBucket[];
    medikamente_top: LabelValue[];
    // Appointments & organisation
    termine_pro_monat: MonthBucket[];
    termin_status: LabelValue[];
    termin_art: LabelValue[];
    // Finance
    einnahmen_pro_monat: MonthBucket[];
    umsatz_nach_zahlungsart: LabelValue[];
    einnahmen_aktueller_monat: number;
    // Orders
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
