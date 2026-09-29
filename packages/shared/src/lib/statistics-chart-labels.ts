import { clinicalServiceLabel } from "./clinical-service-label";
import { orderStatusDisplay, paymentMethodLabel } from "./finance-order-labels";
import type { Locale } from "./i18n";
import { useLocale } from "./i18n";

export type StatisticsChartLabelKind =
    | "appointment_status"
    | "appointment_kind"
    | "payment"
    | "order_status"
    | "patient_status"
    | "sex"
    | "age"
    | "diagnosis"
    | "treatment_category"
    | "service";

type TFn = (key: string) => string;

function token(raw: string): string {
    return raw.trim().toLowerCase().replace(/[\s/-]+/g, "_");
}

function lookup(t: TFn, key: string | undefined, fallback: string): string {
    if (!key) return fallback;
    const out = t(key);
    return out !== key ? out : fallback;
}

const APPOINTMENT_STATUS_KEY: Record<string, string> = {
    planned: "appointment.status.planned",
    confirmed: "appointment.status.confirmed",
    completed: "appointment.status.completed",
    no_show: "appointment.status.no_show",
    noshow: "appointment.status.no_show",
    cancelled: "appointment.status.cancelled",
    canceled: "appointment.status.cancelled",
};

const APPOINTMENT_KIND_KEY: Record<string, string> = {
    first_visit: "appointment.kind.FIRST_VISIT",
    firstvisit: "appointment.kind.FIRST_VISIT",
    examination: "appointment.kind.EXAMINATION",
    treatment: "appointment.kind.TREATMENT",
    checkup: "appointment.kind.CHECKUP",
    check_up: "appointment.kind.CHECKUP",
    consultation: "appointment.kind.CONSULTATION",
    emergency: "appointment.kind.EMERGENCY",
};

const PATIENT_STATUS_KEY: Record<string, string> = {
    new: "enum.patient_status.new",
    active: "enum.patient_status.active",
    validated: "enum.patient_status.validated",
    readonly: "enum.patient_status.readonly",
    archived: "enum.patient_status.readonly",
};

const SEX_KEY: Record<string, string> = {
    female: "patient.gender.FEMALE",
    male: "patient.gender.MALE",
    männlich: "patient.gender.MALE",
    maennlich: "patient.gender.MALE",
    diverse: "patient.gender.DIVERSE",
    divers: "patient.gender.DIVERSE",
};

const AGE_KEY: Record<string, string> = {
    "<18": "page.statistics.chart.age_band.under_18",
    "18–29": "page.statistics.chart.age_band.18_29",
    "18-29": "page.statistics.chart.age_band.18_29",
    "30–44": "page.statistics.chart.age_band.30_44",
    "30-44": "page.statistics.chart.age_band.30_44",
    "45–59": "page.statistics.chart.age_band.45_59",
    "45-59": "page.statistics.chart.age_band.45_59",
    "60–74": "page.statistics.chart.age_band.60_74",
    "60-74": "page.statistics.chart.age_band.60_74",
    "75+": "page.statistics.chart.age_band.75_plus",
};

const TREATMENT_CATEGORY_KEY: Record<string, string> = {
    checkup: "enum.treatment_catalog.category.checkup",
    fillingtherapy: "enum.treatment_catalog.category.filling_therapy",
    filling_therapy: "enum.treatment_catalog.category.filling_therapy",
    periodontology: "enum.treatment_catalog.category.periodontology",
    prosthodontics: "enum.treatment_catalog.category.prosthodontics",
    surgery: "enum.treatment_catalog.category.surgery",
};

const DIAGNOSIS_KEY: Record<string, string> = {
    gingivitis: "page.statistics.chart.diagnosis.gingivitis",
    periodontitis_stage_i: "page.statistics.chart.diagnosis.periodontitis_stage_i",
    periodontitis: "page.statistics.chart.diagnosis.periodontitis",
    initial_occlusal_caries: "page.statistics.chart.diagnosis.initial_occlusal_caries",
    initial_caries: "page.statistics.chart.diagnosis.initial_caries",
    initial_caries_diagnosis: "page.statistics.chart.diagnosis.initial_caries_diagnosis",
    secondary_caries: "page.statistics.chart.diagnosis.secondary_caries",
    dentine_hypersensitivity: "page.statistics.chart.diagnosis.dentine_hypersensitivity",
    reversible_pulpitis: "page.statistics.chart.diagnosis.reversible_pulpitis",
    irreversible_pulpitis: "page.statistics.chart.diagnosis.irreversible_pulpitis",
    cracked_tooth_syndrome: "page.statistics.chart.diagnosis.cracked_tooth",
    pericoronitis: "page.statistics.chart.diagnosis.pericoronitis",
    abrasion_attrition: "page.statistics.chart.diagnosis.abrasion_attrition",
    healthy_recall: "page.statistics.chart.diagnosis.healthy_recall",
    healthy: "page.statistics.chart.diagnosis.healthy",
    apical_periodontitis: "page.statistics.chart.diagnosis.apical_periodontitis",
    tooth_fracture: "page.statistics.chart.diagnosis.tooth_fracture",
    fracture_risk: "page.statistics.chart.diagnosis.fracture_risk",
    peri_implant_mucositis: "page.statistics.chart.diagnosis.peri_implant_mucositis",
    caries: "page.statistics.chart.diagnosis.caries",
    filling_intact: "page.statistics.chart.diagnosis.filling_intact",
    pocket_4mm: "page.statistics.chart.diagnosis.pocket_4mm",
    crack: "page.statistics.chart.diagnosis.crack",
    abrasion: "page.statistics.chart.diagnosis.abrasion",
    missing: "page.statistics.chart.diagnosis.missing",
    crown: "page.statistics.chart.diagnosis.crown",
    implant: "page.statistics.chart.diagnosis.implant",
    sealant: "page.statistics.chart.diagnosis.sealant",
    watch: "page.statistics.chart.diagnosis.watch",
};

function tryAppointmentKind(raw: string, t: TFn): string | null {
    const fromToken = APPOINTMENT_KIND_KEY[token(raw)];
    if (fromToken) return lookup(t, fromToken, raw);
    const fromCode = `appointment.kind.${raw.trim().toUpperCase().replace(/\s+/g, "_")}`;
    const labeled = t(fromCode);
    return labeled !== fromCode ? labeled : null;
}

export function statisticsChartLabel(
    raw: string,
    t: TFn,
    kind: StatisticsChartLabelKind,
    locale?: Locale,
): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    const loc = locale ?? useLocale.getState().locale;

    switch (kind) {
        case "appointment_status":
            return lookup(t, APPOINTMENT_STATUS_KEY[token(trimmed)], trimmed);
        case "appointment_kind":
            return tryAppointmentKind(trimmed, t) ?? trimmed;
        case "payment": {
            const code = trimmed.includes("_") || trimmed === trimmed.toUpperCase() ? trimmed.toUpperCase() : token(trimmed).toUpperCase();
            const aliases: Record<string, string> = {
                CASH: "CASH",
                CARD: "CARD",
                BANK_TRANSFER: "BANK_TRANSFER",
                INVOICE: "INVOICE",
                BANKTRANSFER: "BANK_TRANSFER",
            };
            const mapped = aliases[code] ?? aliases[token(trimmed).toUpperCase()];
            return mapped ? paymentMethodLabel(mapped, t) : trimmed;
        }
        case "order_status": {
            const aliases: Record<string, string> = {
                open: "OPEN",
                in_transit: "IN_TRANSIT",
                intransit: "IN_TRANSIT",
                delivered: "DELIVERED",
                cancelled: "CANCELLED",
                canceled: "CANCELLED",
            };
            const code = aliases[token(trimmed)] ?? trimmed.toUpperCase();
            return orderStatusDisplay(code, t).label;
        }
        case "patient_status":
            return lookup(t, PATIENT_STATUS_KEY[token(trimmed)], trimmed);
        case "sex":
            return lookup(t, SEX_KEY[token(trimmed)], trimmed);
        case "age":
            return lookup(t, AGE_KEY[trimmed] ?? AGE_KEY[trimmed.replace("–", "-")], trimmed);
        case "treatment_category":
            return lookup(t, TREATMENT_CATEGORY_KEY[token(trimmed)] ?? TREATMENT_CATEGORY_KEY[token(trimmed).replace(/_/g, "")], trimmed);
        case "diagnosis": {
            const key = DIAGNOSIS_KEY[token(trimmed)];
            if (key) return lookup(t, key, trimmed);
            return clinicalServiceLabel(trimmed, loc);
        }
        case "service":
            return clinicalServiceLabel(trimmed, loc);
        default:
            return trimmed;
    }
}

export function localizeChartRows(
    rows: ReadonlyArray<{ label: string; value: number }>,
    t: TFn,
    kind: StatisticsChartLabelKind,
): Array<{ label: string; value: number }> {
    return rows.map((row) => ({ ...row, label: statisticsChartLabel(row.label, t, kind) }));
}
