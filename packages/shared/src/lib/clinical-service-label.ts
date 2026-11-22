import type { Locale } from "./i18n";
import { translateLocale, useLocale } from "./i18n";

/** English catalog phrases as stored in SQLite (lookup keys, not UI copy). */
export const CLINICAL_CATALOG_ENGLISH: readonly string[] = [
    "Vitality test",
    "Occlusal analysis",
    "TMJ screening",
    "Professional cleaning",
    "Airflow polish",
    "Fluoride varnish",
    "Fissure sealant per tooth",
    "Oral hygiene instruction",
    "Desensitizing treatment",
    "One-surface composite",
    "Two-surface composite",
    "Three-surface composite",
    "Composite buildup",
    "Glass ionomer filling",
    "Temporary filling",
    "Pocket depth measurement",
    "Scaling & root planing quadrant",
    "Periodontal maintenance",
    "Local antibiotic pocket",
    "Gingivectomy",
    "Root canal anterior",
    "Root canal premolar",
    "Root canal molar",
    "Endo retreatment",
    "Pulp capping",
    "Simple extraction",
    "Surgical extraction",
    "Wisdom tooth removal",
    "Apicoectomy",
    "Implant uncovering",
    "Abscess incision",
    "Crown preparation",
    "Zirconia crown",
    "Bridge unit",
    "Partial denture",
    "Denture reline",
    "Temporary crown",
    "Bleaching tray set",
    "In-office bleaching",
    "Composite veneer",
    "Smile design consult",
    "Splint therapy hard",
    "Splint adjustment",
    "Bruxism consult",
    "Aligner consult",
    "Retainers",
    "Space maintainer",
    "Impression / scan",
    "Shade matching",
    "Recall / checkup",
    "New patient intake exam",
    "Child recall",
    "Emergency triage",
    "Periodontal charting",
    "Bitewing radiographs",
    "Panoramic X-ray",
    "Tooth extraction",
    "Partial denture consult",
];

export function clinicalCatalogPhraseKey(english: string): string {
    return (
        "clinical.catalog." +
        english
            .trim()
            .toLowerCase()
            .replace(/&/g, "and")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_|_$/g, "")
    );
}

const SORTED_ENGLISH = [...CLINICAL_CATALOG_ENGLISH].sort((a, b) => b.length - a.length);

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Display name for a treatment: service, then description, then kind. */
export function treatmentLineLabel(
    line: { service_name?: string | null; description?: string | null; kind?: string | null },
    fallback = "",
): string {
    return (line.service_name || line.description || line.kind || fallback).trim();
}

/** Display name for an examination: service, then diagnosis. */
export function examinationLineLabel(
    line: { service_name?: string | null; diagnosis?: string | null },
    fallback = "",
): string {
    return (line.service_name || line.diagnosis || fallback).trim();
}

/** Replace every English catalog phrase in mixed task/payment copy. */
export function clinicalServiceLabel(name: string, locale?: Locale): string {
    const trimmed = name.trim();
    if (!trimmed) return trimmed;
    const loc = locale ?? useLocale.getState().locale;
    if (loc === "en") return trimmed;
    let out = trimmed;
    for (const english of SORTED_ENGLISH) {
        const label = translateLocale(loc, clinicalCatalogPhraseKey(english));
        if (!label || label === clinicalCatalogPhraseKey(english)) continue;
        out = out.replace(new RegExp(escapeRegExp(english), "gi"), label);
    }
    return out;
}
