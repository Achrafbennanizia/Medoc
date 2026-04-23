export type { PatientFormData } from "./patient";
export type { TerminFormData, TerminFilter } from "./termin";
export type { BehandlungFormData, UntersuchungFormData } from "./behandlung";
export type { ZahlungFormData, FinanzdokumentFormData } from "./zahlung";
export type { PersonalFormData, LoginFormData, LeistungFormData, ProduktFormData } from "./personal";

export { patientSchema, patientSearchSchema } from "./patient";
export { terminSchema, terminFilterSchema } from "./termin";
export { behandlungSchema, untersuchungSchema } from "./behandlung";
export { zahlungSchema, finanzdokumentSchema } from "./zahlung";
export { personalSchema, loginSchema, leistungSchema, produktSchema } from "./personal";
