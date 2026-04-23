import { z } from "zod";

export const behandlungSchema = z.object({
    akteId: z.string().min(1, "Patientenakte erforderlich"),
    behandlungsart: z.string().min(1, "Behandlungsart erforderlich"),
    verlauf: z.string().optional(),
    materialien: z.string().optional(),
    dokumentation: z.string().optional(),
    erfolg: z.boolean().optional(),
    abbruchgrund: z.string().optional(),
    leistungId: z.string().optional(),
});

export type BehandlungFormData = z.infer<typeof behandlungSchema>;

export const untersuchungSchema = z.object({
    akteId: z.string().min(1, "Patientenakte erforderlich"),
    beschwerden: z.string().min(1, "Beschwerden erforderlich"),
    untersuchungsergebnisse: z.string().optional(),
    diagnose: z.string().optional(),
    bildmaterial: z.string().optional(),
});

export type UntersuchungFormData = z.infer<typeof untersuchungSchema>;
