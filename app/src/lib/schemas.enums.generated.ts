/** @generated from config/enums.yaml — do not edit. */
import { z } from "zod";
import { AKTEN_STATUS_VALUES, FEEDBACK_KATEGORIE_VALUES, GESCHLECHT_VALUES, PATIENT_STATUS_VALUES, ROLLE_VALUES, TERMIN_ART_VALUES, TERMIN_STATUS_VALUES, ZAHLUNGS_ART_VALUES, ZAHLUNGS_STATUS_VALUES } from "./enums.generated";

export const AktenStatusSchema = z.enum(AKTEN_STATUS_VALUES);
export const FeedbackKategorieSchema = z.enum(FEEDBACK_KATEGORIE_VALUES);
export const GeschlechtSchema = z.enum(GESCHLECHT_VALUES);
export const PatientStatusSchema = z.enum(PATIENT_STATUS_VALUES);
export const RolleSchema = z.enum(ROLLE_VALUES);
export const TerminArtSchema = z.enum(TERMIN_ART_VALUES);
export const TerminStatusSchema = z.enum(TERMIN_STATUS_VALUES);
export const ZahlungsartSchema = z.enum(ZAHLUNGS_ART_VALUES);
export const ZahlungStatusSchema = z.enum(ZAHLUNGS_STATUS_VALUES);
