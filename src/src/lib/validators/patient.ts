import { z } from "zod";

export const patientSchema = z.object({
    name: z.string().min(2, "Name muss mindestens 2 Zeichen lang sein"),
    geburtsdatum: z.coerce.date({ message: "Ungültiges Geburtsdatum" }),
    geschlecht: z.enum(["MAENNLICH", "WEIBLICH", "DIVERS"], {
        message: "Bitte Geschlecht auswählen",
    }),
    versicherungsnummer: z
        .string()
        .min(5, "Versicherungsnummer muss mindestens 5 Zeichen lang sein"),
    telefon: z.string().optional(),
    email: z.string().email("Ungültige E-Mail-Adresse").optional().or(z.literal("")),
    adresse: z.string().optional(),
});

export type PatientFormData = z.infer<typeof patientSchema>;

export const patientSearchSchema = z.object({
    query: z.string().min(1),
});
