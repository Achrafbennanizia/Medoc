import { z } from "zod";

export const terminSchema = z.object({
    datum: z.coerce.date({ message: "Ungültiges Datum" }),
    uhrzeit: z
        .string()
        .regex(/^\d{2}:\d{2}$/, "Format HH:MM erforderlich"),
    art: z.enum(["UNTERSUCHUNG", "BEHANDLUNG", "NOTFALL"], {
        message: "Bitte Terminart auswählen",
    }),
    patientId: z.string().min(1, "Patient muss ausgewählt werden"),
    arztId: z.string().min(1, "Arzt muss ausgewählt werden"),
    beschwerden: z.string().optional(),
});

export type TerminFormData = z.infer<typeof terminSchema>;

export const terminFilterSchema = z.object({
    datum: z.coerce.date().optional(),
    arztId: z.string().optional(),
    status: z.enum(["ANGEFRAGT", "BESTAETIGT", "DURCHGEFUEHRT", "ABGESCHLOSSEN", "STORNIERT"]).optional(),
});

export type TerminFilter = z.infer<typeof terminFilterSchema>;
