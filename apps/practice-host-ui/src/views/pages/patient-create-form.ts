/** Form state of the new-patient page (patient-create.tsx). */
import type { Sex } from "@/models/types";

export type FormState = {
    last_name: string;
    first_name: string;
    date_of_birth: string;
    sex: Sex;
    phone: string;
    email: string;
    address: string;
    insuranceStatus: string;
    health_insurance: string;
    insurance_number: string;
    chronic: string;
    previousDiagnoses: string;
    surgeries: string;
    hospital: string;
    mental: string;
    medications: string;
    dosing: string;
    selfMedication: string;
    missedDoses: string;
    sideEffects: string;
    allergiesMed: string;
    allergiesFoods: string;
    allergiesOther: string;
    material: string;
    vaccineReactions: string;
};

export const initialForm: FormState = {
    last_name: "",
    first_name: "",
    date_of_birth: "",
    sex: "MALE",
    phone: "",
    email: "",
    address: "",
    insuranceStatus: "GKV",
    health_insurance: "",
    insurance_number: "",
    chronic: "",
    previousDiagnoses: "",
    surgeries: "",
    hospital: "",
    mental: "",
    medications: "",
    dosing: "",
    selfMedication: "",
    missedDoses: "",
    sideEffects: "",
    allergiesMed: "",
    allergiesFoods: "",
    allergiesOther: "",
    material: "",
    vaccineReactions: "",
};
