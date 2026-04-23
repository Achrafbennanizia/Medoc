import { z } from "zod";

export const zahlungSchema = z.object({
    patientId: z.string().min(1, "Patient erforderlich"),
    betrag: z.coerce.number().positive("Betrag muss positiv sein"),
    zahlungsart: z.enum(["BAR", "KARTE", "UEBERWEISUNG"], {
        message: "Bitte Zahlungsart auswählen",
    }),
    beschreibung: z.string().optional(),
    leistungId: z.string().optional(),
});

export type ZahlungFormData = z.infer<typeof zahlungSchema>;

export const finanzdokumentSchema = z.object({
    typ: z.enum(["Einnahme", "Ausgabe"]),
    betrag: z.coerce.number().positive("Betrag muss positiv sein"),
    kategorie: z.string().optional(),
    beschreibung: z.string().optional(),
    zeitraum: z.coerce.date(),
});

export type FinanzdokumentFormData = z.infer<typeof finanzdokumentSchema>;
