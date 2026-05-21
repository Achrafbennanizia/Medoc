/**
 * Centralised Zod schemas for IPC boundary validation.
 *
 * Every controller that posts data to the backend should pass user input
 * through a schema in this file. Backend validation remains the source of
 * truth (defense in depth), but client-side validation gives instant,
 * actionable error messages without a round-trip.
 *
 * Conventions:
 * - Enum literals: `config/enums.yaml` → {@link ./enums.generated.ts} (via `cargo build`).
 * - Mirror the Rust DTO field names exactly (snake_case).
 * - Strings are trimmed only when the backend also trims them.
 */
import { z } from "zod";
import {
    FeedbackKategorieSchema,
    GeschlechtSchema,
    PatientStatusSchema,
    RolleSchema,
    TerminArtSchema,
    TerminStatusSchema,
    ZahlungsartSchema,
} from "@/lib/schemas.enums.generated";

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

export {
    AktenStatusSchema,
    FeedbackKategorieSchema,
    GeschlechtSchema,
    PatientStatusSchema,
    RolleSchema,
    TerminArtSchema,
    TerminStatusSchema,
    ZahlungsartSchema,
    ZahlungStatusSchema,
} from "@/lib/schemas.enums.generated";
/** @deprecated Use {@link GeschlechtSchema}. */
export const PatientGeschlechtSchema = GeschlechtSchema;

export const CreatePatientSchema = z.object({
    name: nonEmpty("Name ist erforderlich").max(120),
    geburtsdatum: isoDate,
    geschlecht: GeschlechtSchema,
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
        status: PatientStatusSchema.optional(),
    })
    .strict();

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

export const CreatePersonalSchema = z.object({
    name: nonEmpty().max(120),
    email: z.string().email("Ungültige E-Mail"),
    passwort: z.string().min(8, "Mindestens 8 Zeichen"),
    rolle: RolleSchema,
    taetigkeitsbereich: optionalText,
    fachrichtung: optionalText,
    telefon: optionalText,
});

export const UpdatePersonalSchema = z
    .object({
        name: z.string().min(1).max(120).optional(),
        email: z.string().email("Ungültige E-Mail").optional(),
        rolle: RolleSchema.optional(),
        taetigkeitsbereich: optionalText,
        fachrichtung: optionalText,
        telefon: optionalText,
        verfuegbar: z.boolean().optional(),
    })
    .strict();

/** Eigenes Konto (Einstellungen) — mindestens ein Feld erforderlich. */
export const UpdateOwnProfileSchema = z
    .object({
        name: z.string().min(1).max(120).optional(),
        email: z.string().email("Ungültige E-Mail").optional(),
        taetigkeitsbereich: optionalText,
        fachrichtung: optionalText,
        /** Leerstring löscht die gespeicherte Nummer (wie Backend). */
        telefon: z.string().max(40).optional(),
    })
    .strict()
    .refine(
        (d) =>
            d.name != null ||
            d.email != null ||
            d.taetigkeitsbereich != null ||
            d.fachrichtung != null ||
            d.telefon !== undefined,
        { message: "Mindestens ein Feld zum Speichern ausfüllen" },
    );

export const CreateZahlungSchema = z.object({
    patient_id: nonEmpty(),
    betrag: z.number().nonnegative("Betrag darf nicht negativ sein"),
    zahlungsart: ZahlungsartSchema,
    leistung_id: optionalText,
    beschreibung: optionalText,
    behandlung_id: optionalText,
    untersuchung_id: optionalText,
    betrag_erwartet: z.number().finite().nonnegative().optional().nullable(),
});

export const UpdateZahlungSchema = z
    .object({
        id: nonEmpty(),
        betrag: z.number().nonnegative(),
        zahlungsart: ZahlungsartSchema,
        leistung_id: optionalText,
        beschreibung: optionalText,
    })
    .strict();

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
    name: nonEmpty().max(200),
    beschreibung: optionalText,
    kategorie: nonEmpty().max(80),
    preis: z.number().nonnegative(),
});

export const UpdateLeistungSchema = z
    .object({
        name: z.string().min(1).max(200).optional(),
        beschreibung: optionalText,
        kategorie: z.string().min(1).max(80).optional(),
        preis: z.number().nonnegative().optional(),
        aktiv: z.boolean().optional(),
    })
    .strict();

export const CreateRezeptSchema = z.object({
    patient_id: nonEmpty("Patient ist erforderlich"),
    arzt_id: nonEmpty(),
    medikament: nonEmpty("Medikament ist erforderlich").max(200),
    wirkstoff: optionalText,
    dosierung: nonEmpty().max(200),
    dauer: nonEmpty().max(200),
    hinweise: optionalText,
    pzn: optionalText,
    darreichungsform: optionalText,
    packungsgroesse: optionalText,
    menge: z.number().int().positive().optional().nullable(),
    aut_idem: z.boolean().optional().nullable(),
    rezept_typ: z.enum(["PRIVAT", "KASSE", "BTM"]).optional().nullable(),
    icd10_code: optionalText,
    verordnender_arzt_id: optionalText,
});

export const UpdateRezeptSchema = z.object({
    id: nonEmpty(),
    medikament: nonEmpty().max(200),
    wirkstoff: optionalText,
    dosierung: nonEmpty().max(200),
    dauer: nonEmpty().max(200),
    hinweise: optionalText,
    pzn: optionalText,
    darreichungsform: optionalText,
    packungsgroesse: optionalText,
    menge: z.number().int().positive().optional().nullable(),
    aut_idem: z.boolean().optional().nullable(),
    rezept_typ: z.enum(["PRIVAT", "KASSE", "BTM"]).optional().nullable(),
    icd10_code: optionalText,
    verordnender_arzt_id: optionalText,
});

export const CreateAttestSchema = z.object({
    patient_id: nonEmpty(),
    arzt_id: nonEmpty(),
    typ: nonEmpty(),
    inhalt: nonEmpty().max(5000),
    gueltig_von: isoDate,
    gueltig_bis: isoDate,
    icd10_code: optionalText,
    erst_oder_folge: z.enum(["ERST", "FOLGE"]).optional().nullable(),
    arbeitgeber: optionalText,
    ausstellender_arzt_id: optionalText,
});

export const CreateBehandlungSchema = z.object({
    akte_id: nonEmpty(),
    art: nonEmpty(),
    beschreibung: optionalText,
    zaehne: optionalText,
    material: optionalText,
    notizen: optionalText,
    kategorie: optionalText,
    leistungsname: optionalText,
    behandlungsnummer: optionalText,
    sitzung: z.number().int().optional().nullable(),
    behandlung_status: optionalText,
    gesamtkosten: z.number().finite().optional().nullable(),
    termin_erforderlich: z.boolean().optional().nullable(),
    behandlung_datum: z.union([isoDate, z.literal(""), z.null()]).optional().nullable().transform((v) => (v === "" ? null : v)),
});

export const UpdateBehandlungSchema = z.object({
    id: nonEmpty(),
    art: nonEmpty(),
    beschreibung: optionalText,
    zaehne: optionalText,
    material: optionalText,
    notizen: optionalText,
    kategorie: optionalText,
    leistungsname: optionalText,
    behandlungsnummer: optionalText,
    sitzung: z.number().int().optional().nullable(),
    behandlung_status: optionalText,
    gesamtkosten: z.number().finite().optional().nullable(),
    termin_erforderlich: z.boolean().optional().nullable(),
    behandlung_datum: z.union([isoDate, z.literal(""), z.null()]).optional().nullable().transform((v) => (v === "" ? null : v)),
});

export const CreateUntersuchungSchema = z.object({
    akte_id: nonEmpty(),
    beschwerden: optionalText,
    ergebnisse: optionalText,
    diagnose: optionalText,
    untersuchungsnummer: optionalText,
});

export const UpdateUntersuchungSchema = z.object({
    id: nonEmpty(),
    beschwerden: optionalText,
    ergebnisse: optionalText,
    diagnose: optionalText,
});

export const CreateZahnbefundSchema = z.object({
    akte_id: nonEmpty(),
    zahn_nummer: z.number().int(),
    befund: nonEmpty(),
    diagnose: optionalText,
    notizen: optionalText,
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
    kategorie: FeedbackKategorieSchema,
    betreff: z.string().min(3, "Betreff zu kurz").max(200),
    nachricht: z.string().min(10, "Nachricht zu kurz").max(4000),
    referenz: optionalText,
});

export type UpdateLeistungInput = z.infer<typeof UpdateLeistungSchema>;

/**
 * Convert a ZodError into a single human-readable string suitable for toasts.
 * Joins all issues with `"; "`.
 */
export function zodErrorToMessage(err: unknown): string {
    if (err instanceof z.ZodError) {
        if (!err.issues.length) return "Validierungsfehler";
        return err.issues
            .map((issue) => {
                const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
                return `${path}${issue.message}`;
            })
            .join("; ");
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
