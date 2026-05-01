/**
 * Centralised Zod schemas for IPC boundary validation.
 *
 * Every controller that posts data to the backend should pass user input
 * through a schema in this file. Backend validation remains the source of
 * truth (defense in depth), but client-side validation gives instant,
 * actionable error messages without a round-trip.
 *
 * Conventions:
 * - Mirror the Rust DTO field names exactly (snake_case).
 * - Default permissive on optional/null distinction so we don't reject
 *   payloads the backend would accept.
 * - Strings are trimmed via `.transform(s => s.trim())` only when the
 *   backend also trims them (otherwise we'd silently change values).
 */
import { z } from "zod";

const isoDate = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Erwartetes Format: YYYY-MM-DD");
const isoTime = z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Erwartetes Format: HH:MM");
const nonEmpty = (msg = "Pflichtfeld") =>
    z.string().min(1, msg);
const optionalText = z
    .union([z.string(), z.null(), z.undefined()])
    .optional()
    .transform((v) => (v == null || v === "" ? null : v));

/** Matches Rust `Geschlecht` / DB CHECK and `PatientCreatePage` Select values. */
export const PatientGeschlechtSchema = z.enum(["MAENNLICH", "WEIBLICH", "DIVERS"]);

export const CreatePatientSchema = z.object({
    name: nonEmpty("Name ist erforderlich").max(120),
    geburtsdatum: isoDate,
    geschlecht: PatientGeschlechtSchema,
    versicherungsnummer: nonEmpty("Versicherungsnummer fehlt").max(40),
    telefon: optionalText,
    email: z
        .union([z.string().email("Ungültige E-Mail"), z.literal(""), z.null(), z.undefined()])
        .optional()
        .transform((v) => (v == null || v === "" ? null : v)),
    adresse: optionalText,
});
export type CreatePatientInput = z.infer<typeof CreatePatientSchema>;

export const UpdatePatientSchema = z
    .object({
        name: z.string().min(1).max(120).optional(),
        telefon: optionalText,
        email: z.union([z.string().email(), z.literal(""), z.null(), z.undefined()]).optional(),
        adresse: optionalText,
        status: z.enum(["NEU", "AKTIV", "VALIDIERT", "READONLY"]).optional(),
    })
    .strict();

export const TerminArtSchema = z.enum([
    "ROUTINE",
    "NOTFALL",
    "KONTROLLE",
    "BERATUNG",
    "BEHANDLUNG",
]);
export const TerminStatusSchema = z.enum([
    "GEPLANT",
    "BESTAETIGT",
    "DURCHGEFUEHRT",
    "NICHTERSCHIENEN",
    "ABGESAGT",
]);

export const CreateTerminSchema = z.object({
    datum: isoDate,
    uhrzeit: isoTime,
    art: TerminArtSchema,
    patient_id: nonEmpty("Patient fehlt"),
    arzt_id: nonEmpty("Behandler fehlt"),
    notizen: optionalText,
    beschwerden: optionalText,
});
export type CreateTerminInput = z.infer<typeof CreateTerminSchema>;

export const UpdateTerminSchema = z
    .object({
        datum: isoDate.optional(),
        uhrzeit: isoTime.optional(),
        art: TerminArtSchema.optional(),
        status: TerminStatusSchema.optional(),
        notizen: optionalText,
        beschwerden: optionalText,
        arzt_id: z.string().min(1).optional(),
    })
    .strict();

export const RolleSchema = z.enum([
    "ARZT",
    "REZEPTION",
    "PHARMABERATER",
    "STEUERBERATER",
]);

export const CreatePersonalSchema = z.object({
    name: nonEmpty().max(120),
    email: z.string().email("Ungültige E-Mail"),
    passwort: z.string().min(8, "Mindestens 8 Zeichen"),
    rolle: RolleSchema,
    taetigkeitsbereich: optionalText,
    fachrichtung: optionalText,
    telefon: optionalText,
});

export const ZahlungsartSchema = z.enum(["BAR", "KARTE", "UEBERWEISUNG", "VERSICHERUNG"]);
export const ZahlungStatusSchema = z.enum(["AUSSTEHEND", "TEILBEZAHLT", "BEZAHLT", "STORNIERT"]);

export const CreateZahlungSchema = z.object({
    patient_id: nonEmpty(),
    betrag: z.number().nonnegative("Betrag darf nicht negativ sein"),
    zahlungsart: ZahlungsartSchema,
    leistung_id: optionalText,
    beschreibung: optionalText,
});

export const CreateBestellungSchema = z.object({
    lieferant: nonEmpty().max(200),
    artikel: nonEmpty().max(200),
    erwartet_am: z.union([isoDate, z.literal(""), z.null(), z.undefined()])
        .optional()
        .transform((v) => (v == null || v === "" ? null : v)),
    menge: z.number().int().positive("Menge muss > 0 sein"),
    einheit: optionalText,
    bemerkung: optionalText,
    bestellnummer: optionalText,
    pharmaberater: optionalText,
    /** Summe (Lager-Einzelpreis × Menge) bei Erfassung; optional für alte Klienten. */
    gesamtbetrag: z.number().finite().nonnegative().optional().nullable(),
});

export const UpdateBestellungSchema = z
    .object({
        lieferant: z.string().min(1).max(200).optional(),
        artikel: z.string().min(1).max(200).optional(),
        menge: z.number().int().positive("Menge muss > 0 sein").optional(),
        einheit: optionalText,
        erwartet_am: z.union([isoDate, z.literal(""), z.null(), z.undefined()])
            .optional()
            .transform((v) => (v == null ? undefined : v === "" ? null : v)),
        bemerkung: optionalText,
        bestellnummer: optionalText,
        pharmaberater: optionalText,
    })
    .strict();

export const CreateLeistungSchema = z.object({
    bezeichnung: nonEmpty().max(200),
    kategorie: nonEmpty().max(80),
    preis: z.number().nonnegative(),
    dauer_minuten: z.number().int().nonnegative(),
    beschreibung: optionalText,
    aktiv: z.boolean().optional(),
});

export const CreateRezeptSchema = z.object({
    patient_id: nonEmpty("Patient ist erforderlich"),
    medikament: nonEmpty("Medikament ist erforderlich").max(200),
    dosierung: nonEmpty().max(200),
    einnahmehinweise: optionalText,
    gueltig_bis: isoDate.optional(),
    arzt_id: nonEmpty(),
});

export const CreateAttestSchema = z.object({
    patient_id: nonEmpty(),
    arzt_id: nonEmpty(),
    art: nonEmpty(),
    inhalt: nonEmpty().max(5000),
    von_datum: isoDate.optional(),
    bis_datum: isoDate.optional(),
});

export const CreateBilanzSnapshotSchema = z.object({
    zeitraum: nonEmpty(),
    typ: nonEmpty(),
    label: nonEmpty(),
    einnahmen_cents: z.number().int().nonnegative(),
    ausgaben_cents: z.number().int().nonnegative(),
    payload: z.unknown(),
});

export const CreateFeedbackSchema = z.object({
    kategorie: z.enum(["feedback", "vigilance", "technical"]),
    betreff: z.string().min(3, "Betreff zu kurz").max(200),
    nachricht: z.string().min(10, "Nachricht zu kurz").max(4000),
    referenz: optionalText,
});

/**
 * Convert a ZodError into a single human-readable string suitable for toasts.
 * Returns the first message; collapses nested errors so the user sees one
 * actionable line, not a JSON dump.
 */
export function zodErrorToMessage(err: unknown): string {
    if (err instanceof z.ZodError) {
        const first = err.issues[0];
        if (!first) return "Validierungsfehler";
        const path = first.path.length ? `${first.path.join(".")}: ` : "";
        return `${path}${first.message}`;
    }
    return err instanceof Error ? err.message : String(err);
}

/**
 * Throw a typed error with a user-facing message if the parse fails.
 * Use at controller boundaries: `const safe = parseOrThrow(Schema, data);`
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new Error(zodErrorToMessage(result.error));
    }
    return result.data;
}
