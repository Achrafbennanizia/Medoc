-- @generated from config/enums.yaml — reference CHECK fragments for migrations.
-- Do not edit; regenerate with `cargo build`.

-- AktenStatus (patientenakte.status)
-- CHECK (... IN ('ENTWURF','IN_BEARBEITUNG','VALIDIERT','READONLY'))

-- BestellStatus (bestellung.status)
-- CHECK (... IN ('OFFEN','UNTERWEGS','GELIEFERT','STORNIERT'))

-- FeedbackKategorie (feedback.kategorie)
-- CHECK (... IN ('feedback','vigilance','technical'))

-- FeedbackStatus (feedback.status)
-- CHECK (... IN ('OFFEN','BEARBEITUNG','ERLEDIGT'))

-- Geschlecht (patient.geschlecht)
-- CHECK (... IN ('MAENNLICH','WEIBLICH','DIVERS'))

-- PatientStatus (patient.status)
-- CHECK (... IN ('NEU','AKTIV','VALIDIERT','READONLY'))

-- Rolle (personal.rolle)
-- CHECK (... IN ('ARZT','REZEPTION','STEUERBERATER','PHARMABERATER'))

-- TerminArt (termin.art)
-- CHECK (... IN ('ERSTBESUCH','UNTERSUCHUNG','BEHANDLUNG','KONTROLLE','BERATUNG'))

-- TerminStatus (termin.status)
-- CHECK (... IN ('GEPLANT','BESTAETIGT','DURCHGEFUEHRT','NICHT_ERSCHIENEN','ABGESAGT'))

-- ZahlungsArt (zahlung.zahlungsart)
-- CHECK (... IN ('BAR','KARTE','UEBERWEISUNG','RECHNUNG'))

-- ZahlungsStatus (zahlung.status)
-- CHECK (... IN ('AUSSTEHEND','BEZAHLT','TEILBEZAHLT','STORNIERT'))

