/** @generated from config/enums.yaml — do not edit. Run `cargo build` to refresh. */

export const AKTEN_STATUS_VALUES = ["ENTWURF", "IN_BEARBEITUNG", "VALIDIERT", "READONLY"] as const;
export type AktenStatus = (typeof AKTEN_STATUS_VALUES)[number];

export const BESTELL_STATUS_VALUES = ["OFFEN", "UNTERWEGS", "GELIEFERT", "STORNIERT"] as const;
export type BestellStatus = (typeof BESTELL_STATUS_VALUES)[number];

export const FEEDBACK_KATEGORIE_VALUES = ["feedback", "vigilance", "technical"] as const;
export type FeedbackKategorie = (typeof FEEDBACK_KATEGORIE_VALUES)[number];

export const FEEDBACK_STATUS_VALUES = ["OFFEN", "BEARBEITUNG", "ERLEDIGT"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUS_VALUES)[number];

export const GESCHLECHT_VALUES = ["MAENNLICH", "WEIBLICH", "DIVERS"] as const;
export type Geschlecht = (typeof GESCHLECHT_VALUES)[number];

export const PATIENT_STATUS_VALUES = ["NEU", "AKTIV", "VALIDIERT", "READONLY"] as const;
export type PatientStatus = (typeof PATIENT_STATUS_VALUES)[number];

export const ROLLE_VALUES = ["ARZT", "REZEPTION", "STEUERBERATER", "PHARMABERATER"] as const;
export type Rolle = (typeof ROLLE_VALUES)[number];

export const TERMIN_ART_VALUES = ["ERSTBESUCH", "UNTERSUCHUNG", "BEHANDLUNG", "KONTROLLE", "BERATUNG"] as const;
export type TerminArt = (typeof TERMIN_ART_VALUES)[number];

export const TERMIN_STATUS_VALUES = ["GEPLANT", "BESTAETIGT", "DURCHGEFUEHRT", "NICHT_ERSCHIENEN", "ABGESAGT"] as const;
export type TerminStatus = (typeof TERMIN_STATUS_VALUES)[number];

export const ZAHLUNGS_ART_VALUES = ["BAR", "KARTE", "UEBERWEISUNG", "RECHNUNG"] as const;
export type ZahlungsArt = (typeof ZAHLUNGS_ART_VALUES)[number];

export const ZAHLUNGS_STATUS_VALUES = ["AUSSTEHEND", "BEZAHLT", "TEILBEZAHLT", "STORNIERT"] as const;
export type ZahlungsStatus = (typeof ZAHLUNGS_STATUS_VALUES)[number];

