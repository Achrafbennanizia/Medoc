import { z } from "zod";

export const personalSchema = z.object({
    name: z.string().min(2, "Name erforderlich"),
    email: z.string().email("Ungültige E-Mail"),
    passwort: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
    rolle: z.enum(["ARZT", "REZEPTION", "STEUERBERATER", "PHARMABERATER"]),
    taetigkeitsbereich: z.string().optional(),
    fachrichtung: z.string().optional(),
    telefon: z.string().optional(),
});

export type PersonalFormData = z.infer<typeof personalSchema>;

export const loginSchema = z.object({
    email: z.string().email("Ungültige E-Mail"),
    passwort: z.string().min(1, "Passwort erforderlich"),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const leistungSchema = z.object({
    name: z.string().min(1, "Name erforderlich"),
    kategorie: z.string().min(1, "Kategorie erforderlich"),
    preis: z.coerce.number().positive("Preis muss positiv sein"),
});

export type LeistungFormData = z.infer<typeof leistungSchema>;

export const produktSchema = z.object({
    name: z.string().min(1, "Name erforderlich"),
    lieferant: z.string().min(1, "Lieferant erforderlich"),
    menge: z.coerce.number().int().min(0),
    hersteller: z.string().optional(),
    preis: z.coerce.number().positive().optional(),
});

export type ProduktFormData = z.infer<typeof produktSchema>;
